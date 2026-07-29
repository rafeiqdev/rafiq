import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { ai, ApiError, bookings, news } from '../lib/api';
import type { ChatSummary } from '../lib/api';
import { readSubject, saveSubject } from '../lib/aiQuota';
import { detectSubject, isTopicSwitch } from '../lib/subject';
import {
  archiveTopic,
  deleteArchived,
  readArchive,
  readClosed,
  setClosed as persistClosed,
  topicTitle,
} from '../lib/chatHistory';
import type { ArchivedTopic } from '../lib/chatHistory';
import type { BookingMedia, ChatMessage } from '../lib/types';
import { RequireAuth } from '../components/Gates';
import { BookingModal } from '../components/BookingModal';
import { Logo } from '../components/Logo';
import { AppIcon } from '../components/AppIcon';
import { MediaChips, AttachCard, MAX_MEDIA_MB, ATTACH_ACCEPT, formatFileList, wantsMedia } from '../components/ChatAttach';
import { ArchivedTopicModal, ChatClosedCard, ChatHistoryModal } from '../components/ChatHistory';
import { SERVICES, pickText } from '../data/services';
import { track } from '../lib/analytics';

/** BCP-47 speech-recognition locale per app language. */
const SPEECH_LANG: Record<string, string> = { ar: 'ar-SA', en: 'en-US', ru: 'ru-RU', fa: 'fa-IR' };

/** Simple inline microphone glyph (no 'mic' entry in the AppIcon registry). */
function MicGlyph({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  );
}

interface UiMessage extends ChatMessage {
  streaming?: boolean;
  /** the assistant signalled it has gathered enough → show the confirm button */
  showConfirm?: boolean;
}

const chatKey = (userId: string) => `rafiq_chat_history_${userId}`;
const mediaKey = (userId: string) => `rafiq_chat_media_${userId}`;

function loadJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '') as T;
  } catch {
    return fallback;
  }
}

function ChatUI() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const userId = user?.id ?? 'guest';
  const [messages, setMessages] = useState<UiMessage[]>(() => loadJson<UiMessage[]>(chatKey(userId), []));
  const [media, setMedia] = useState<BookingMedia[]>(() => loadJson<BookingMedia[]>(mediaKey(userId), []));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const [readyToBook, setReadyToBook] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [booking, setBooking] = useState<ChatSummary | null>(null);
  const [attachDismissed, setAttachDismissed] = useState(false);
  const [listening, setListening] = useState(false);
  // A topic ends when an appointment is booked — the case is a human's from
  // then on, so the assistant stops replying until a new topic is opened.
  const [closed, setClosedState] = useState(() => readClosed(userId));
  const [closedByBooking, setClosedByBooking] = useState(false);
  const [archive, setArchive] = useState<ArchivedTopic[]>(() => readArchive(userId));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewing, setViewing] = useState<ArchivedTopic | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** which ?topic= has already been seeded, so switching services reseeds */
  const seededRef = useRef<string | null>(null);

  const [sp] = useSearchParams();
  const topic = sp.get('topic');
  const newsId = sp.get('news');

  // Covers every way of reaching the chat (service action modal, guide page
  // link, nav bar, direct URL) with one call, rather than tracking each entry
  // point separately.
  useEffect(() => {
    track('chat_opened', { target: topic, meta: { source: topic ? 'service' : 'direct' } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [currentSubject, setCurrentSubject] = useState<string | null>(() => readSubject(userId));
  /** Composer is dead once this topic is finished. */
  const inputLocked = closed;

  // does the assistant's latest message ask the user for documents?
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.streaming);
  const askingForDocs = !!lastAssistant && wantsMedia(lastAssistant.text);
  const showAttachCard = askingForDocs && !attachDismissed && !readyToBook;

  const persistMedia = (next: BookingMedia[]) => {
    setMedia(next);
    try {
      localStorage.setItem(mediaKey(userId), JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  };

  /** File the current conversation into history before clearing it. */
  const archiveCurrent = (booked: boolean) => {
    const kept = messages.filter((m) => !m.streaming).map(({ role, text, ts }) => ({ role, text, ts }));
    if (kept.length === 0) return;
    const next = archiveTopic(
      userId,
      { messages: kept, media, subject: currentSubject, booked, title: topicTitle(kept, t('chat.history.untitled')) },
      Date.now(),
    );
    setArchive(next);
  };

  const startNewTopic = () => {
    archiveCurrent(closedByBooking);
    setMessages([]);
    persistMedia([]);
    setError(null);
    setBooking(null);
    setReadyToBook(false);
    setAttachDismissed(false);
    setClosedState(false);
    setClosedByBooking(false);
    persistClosed(userId, false);
    try {
      localStorage.removeItem(chatKey(userId));
    } catch {
      /* ignore */
    }
    setCurrentSubject(null);
    saveSubject(userId, null);
  };

  // Web Speech API (browser-dependent). Only show the mic button if supported.
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  useEffect(() => {
    localStorage.setItem(chatKey(userId), JSON.stringify(messages.filter((m) => !m.streaming)));
    const c = scrollRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [messages, userId]);

  /**
   * `base` overrides the conversation this message is appended to. Needed when
   * a caller has just reset the thread in the same tick — `messages` state has
   * not updated yet, so without it the new message would land on the old topic.
   */
  const ask = async (text: string, alreadyAppended = false, base?: UiMessage[]) => {
    setError(null);
    setLastFailed(null);
    setAttachDismissed(false);
    setBusy(true);

    const source = base ?? messages;
    const userMsg: UiMessage = { role: 'user', text, ts: Date.now() };
    const history = alreadyAppended ? source : [...source, userMsg];
    if (!alreadyAppended) setMessages(history);

    const placeholderTs = Date.now() + 1;
    setMessages((m) => [...m, { role: 'assistant', text: '', ts: placeholderTs, streaming: true }]);

    try {
      const result = await ai.chat(
        history.map(({ role, text: tx, ts }) => ({ role, text: tx, ts })),
        i18n.language,
        (partial) => setMessages((m) => m.map((msg) => (msg.ts === placeholderTs ? { ...msg, text: partial } : msg))),
      );
      setMessages((m) =>
        m.map((msg) => (msg.ts === placeholderTs ? { ...msg, text: result.reply, streaming: false, showConfirm: result.done } : msg)),
      );
      if (result.done) setReadyToBook(true);
    } catch {
      setMessages((m) => m.filter((msg) => msg.ts !== placeholderTs));
      setError('chat.error');
      setLastFailed(text);
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text || busy || closed) return;

    // Track which subject the open topic is about (used for history titling).
    const incoming = detectSubject(text, currentSubject);
    if (isTopicSwitch(currentSubject, incoming)) {
      setCurrentSubject(incoming);
      saveSubject(userId, incoming);
    }

    track('chat_message_sent', { meta: { message_count: messages.length + 1 } });
    setInput('');
    ask(text);
  };

  const retry = () => {
    if (lastFailed) ask(lastFailed, true);
  };

  const pickFiles = () => fileRef.current?.click();

  const onFilesChosen = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    let acc = media.slice();
    const added: string[] = [];
    try {
      for (const f of Array.from(files)) {
        if (f.size > MAX_MEDIA_MB * 1024 * 1024) {
          setError('chat.attachTooBig');
          continue;
        }
        const m = await bookings.uploadMedia(f);
        acc = [...acc, m];
        added.push(m.name);
        persistMedia(acc);
      }
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'attachments_unavailable' ? 'chat.attachUnavailable' : 'chat.attachError');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }

    // Record the upload IN the transcript. The assistant only ever sees
    // messages — without this it cannot know a file exists, so it would keep
    // asking for documents (or worse, claim it received them).
    if (added.length > 0 && !closed) {
      setAttachDismissed(true);
      await ask(t('chat.attachedNote', { files: formatFileList(added, i18n.language) }));
    }
  };

  const confirmAppointment = async () => {
    if (summarizing) return;
    setSummarizing(true);
    try {
      const transcript = messages.filter((m) => !m.streaming).map(({ role, text, ts }) => ({ role, text, ts }));
      setBooking(await ai.summarize(transcript, i18n.language));
    } finally {
      setSummarizing(false);
    }
  };

  // Topic prefill: arriving with ?topic=<serviceId> seeds the first message.
  // Coming from a service card must ALWAYS open that service's conversation —
  // previously any saved chat made this a no-op, so the user landed back in an
  // unrelated (or already finished) topic instead of the service they picked.
  useEffect(() => {
    if (seededRef.current === topic) return;
    if (!topic) return;
    const svc = SERVICES.find((s) => s.id === topic);
    if (!svc) return;
    setCurrentSubject(svc.category);
    saveSubject(userId, svc.category);
    seededRef.current = topic;

    // Put whatever was open into history, then start this service clean.
    if (messages.length > 0) archiveCurrent(closedByBooking);
    persistMedia([]);
    setError(null);
    setBooking(null);
    setReadyToBook(false);
    setAttachDismissed(false);
    setClosedState(false);
    setClosedByBooking(false);
    persistClosed(userId, false);

    ask(t('chat.topicSeed', { service: pickText(svc.title, i18n.language) }), false, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  // News prefill: ?news=<postId> (the article page's "ask Rafiq" button) seeds
  // the chat with the post itself, so the assistant can actually discuss it.
  useEffect(() => {
    const seedKey = newsId ? `news:${newsId}` : null;
    if (!seedKey || seededRef.current === seedKey) return;
    let live = true;
    news.byId(newsId!).then((post) => {
      if (!live || !post || seededRef.current === seedKey) return;
      const subject = detectSubject(`${post.title} ${post.body ?? ''}`, null);
      setCurrentSubject(subject);
      saveSubject(userId, subject);
      seededRef.current = seedKey;

      if (messages.length > 0) archiveCurrent(closedByBooking);
      persistMedia([]);
      setError(null);
      setBooking(null);
      setReadyToBook(false);
      setAttachDismissed(false);
      setClosedState(false);
      setClosedByBooking(false);
      persistClosed(userId, false);

      const body = (post.body ?? '').slice(0, 800);
      ask(t('chat.newsSeed', { title: post.title, body }).trim(), false, []);
    }, () => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsId]);

  const startVoice = () => {
    if (!SR || listening) return;
    const recognition = new SR();
    recognition.lang = SPEECH_LANG[i18n.language] ?? 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event: any) => setInput(event.results[0][0].transcript);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col" style={{ minHeight: 'calc(100vh - 8rem)' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <Logo size={44} />
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-navy">{t('chat.title')}</h1>
          <p className="text-sm text-navy/70">{t('chat.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {archive.length > 0 && (
            <button onClick={() => setHistoryOpen(true)} className="btn-secondary !h-9 px-3 text-xs">
              <AppIcon name="message-circle" className="w-3.5 h-3.5" />
              {t('chat.history.cta', { count: archive.length })}
            </button>
          )}
          {messages.length > 0 && (
            <button onClick={startNewTopic} className="btn-secondary !h-9 px-3 text-xs">
              <AppIcon name="plus" className="w-3.5 h-3.5" />
              {t('chat.newTopic')}
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="card flex-1 mt-5 p-4 overflow-y-auto overscroll-contain flex flex-col gap-3" style={{ maxHeight: '55vh', minHeight: '40vh' }}>
        <div className="self-start max-w-[85%] rounded-2xl rounded-ss-sm bg-brand-blue px-4 py-3 text-sm text-navy">
          {t('chat.greeting')}
        </div>
        {messages.map((m, i) => (
          <div
            key={`${m.ts}_${i}`}
            className={
              m.role === 'user'
                ? 'self-end max-w-[85%] rounded-2xl rounded-se-sm bg-navy px-4 py-3 text-sm text-white break-anywhere'
                : 'self-start max-w-[85%] rounded-2xl rounded-ss-sm bg-brand-blue px-4 py-3 text-sm text-navy whitespace-pre-line break-anywhere'
            }
          >
            {m.text}
            {m.streaming && <span className="inline-block w-2 h-4 bg-navy/40 animate-pulse ms-1 align-middle" />}
          </div>
        ))}

        {/* the assistant asked for documents → a clear attach prompt */}
        {showAttachCard && !closed && (
          <AttachCard onAttach={pickFiles} onSkip={() => setAttachDismissed(true)} uploading={uploading} />
        )}

        {/* topic finished — the assistant stops here until a new one is opened */}
        {closed && <ChatClosedCard booked={closedByBooking} onNewTopic={startNewTopic} />}

        {/* the assistant has everything → offer to confirm an appointment */}
        {readyToBook && !booking && !closed && (
          <div className="self-center card p-5 text-center max-w-sm" role="status">
            <div className="icon-chip mx-auto">
              <AppIcon name="check-circle" className="w-6 h-6" />
            </div>
            <h2 className="mt-3 font-extrabold text-navy">{t('chat.ready.title')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('chat.ready.body')}</p>
            <button onClick={confirmAppointment} disabled={summarizing} className="btn-primary w-full mt-4 disabled:opacity-60">
              <AppIcon name="calendar" className="w-4 h-4" />
              {summarizing ? t('chat.ready.preparing') : t('chat.ready.cta')}
            </button>
          </div>
        )}

        {error && (
          <div className="self-start max-w-[85%] amber-note flex items-center gap-3" role="alert">
            <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
            <span className="flex-1 min-w-0 break-anywhere">{t(error)}</span>
            {lastFailed && (
              <button onClick={retry} className="btn-primary h-8 px-3 text-xs shrink-0">
                {t('chat.retry')}
              </button>
            )}
          </div>
        )}

      </div>

      {/* attached files */}
      {media.length > 0 && (
        <MediaChips media={media} onRemove={(path) => persistMedia(media.filter((x) => x.path !== path))} />
      )}

      <input ref={fileRef} type="file" accept={ATTACH_ACCEPT} multiple className="hidden" onChange={(e) => onFilesChosen(e.target.files)} />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={pickFiles}
          disabled={uploading || inputLocked}
          aria-label={t('chat.attach')}
          title={t('chat.attach')}
          className="btn-ghost h-12 px-3 shrink-0 disabled:opacity-60"
        >
          <AppIcon name={uploading ? 'hourglass' : 'paperclip'} className="w-5 h-5" />
        </button>
        <input
          className="input h-12 flex-1 min-w-0"
          placeholder={t(closed ? 'chat.closed.placeholder' : 'chat.placeholder')}
          value={input}
          disabled={inputLocked}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        {SR && (
          <button
            type="button"
            onClick={startVoice}
            disabled={busy || inputLocked}
            aria-label={t('chat.voice')}
            title={t('chat.voice')}
            className={`btn-ghost h-12 px-3 shrink-0 disabled:opacity-60 ${listening ? 'text-brand-red' : ''}`}
          >
            <MicGlyph className="w-5 h-5" />
          </button>
        )}
        <button onClick={send} disabled={busy || inputLocked} className="btn-primary h-12 px-4 sm:px-6 shrink-0 disabled:opacity-60">
          {t('common.send')}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-gray-500">{t('chat.disclaimer')}</p>

      {booking && (
        <BookingModal
          problemSummary={booking.summary}
          caseFile={booking.caseFile}
          transcript={messages.filter((m) => !m.streaming).map(({ role, text, ts }) => ({ role, text, ts }))}
          media={media}
          onBooked={() => {
            // The appointment is placed — the case now belongs to a human.
            setClosedState(true);
            setClosedByBooking(true);
            persistClosed(userId, true);
            setReadyToBook(false);
          }}
          onClose={() => setBooking(null)}
        />
      )}

      {historyOpen && (
        <ChatHistoryModal
          topics={archive}
          onOpen={(topic) => {
            setViewing(topic);
            setHistoryOpen(false);
          }}
          onDelete={(id) => setArchive(deleteArchived(userId, id))}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {viewing && <ArchivedTopicModal topic={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

export function Premium() {
  // The assistant is an intake agent that collects a case for a human specialist,
  // so it always requires a signed-in account (name + phone come from it).
  return (
    <RequireAuth>
      <ChatUI />
    </RequireAuth>
  );
}
