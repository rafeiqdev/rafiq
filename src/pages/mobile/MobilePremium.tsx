import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { ai, ApiError, bookings, news, localizeNewsPost } from '../../lib/api';
import type { ChatSummary } from '../../lib/api';
import { readSubject, saveSubject } from '../../lib/aiQuota';
import { detectSubject, isTopicSwitch } from '../../lib/subject';
import {
  archiveTopic,
  deleteArchived,
  readArchive,
  readClosed,
  setClosed as persistClosed,
  topicTitle,
} from '../../lib/chatHistory';
import type { ArchivedTopic } from '../../lib/chatHistory';
import type { BookingMedia, ChatMessage } from '../../lib/types';
import { RequireAuth } from '../../components/Gates';
import { BookingModal } from '../../components/BookingModal';
import { AppIcon } from '../../components/AppIcon';
import { MediaChips, AttachCard, MAX_MEDIA_MB, ATTACH_ACCEPT, formatFileList, wantsMedia } from '../../components/ChatAttach';
import { ArchivedTopicModal, ChatClosedCard, ChatHistoryModal } from '../../components/ChatHistory';
import { SERVICES, pickText } from '../../data/services';
import { track } from '../../lib/analytics';

/** BCP-47 speech-recognition locale per app language. */
const SPEECH_LANG: Record<string, string> = { ar: 'ar-SA', en: 'en-US', ru: 'ru-RU', fa: 'fa-IR' };

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string }> = {
  en: { back: 'Back' },
  ar: { back: 'رجوع' },
  fa: { back: 'بازگشت' },
  ru: { back: 'Назад' },
};

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

function MobileChatUI() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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

  useEffect(() => {
    track('chat_opened', { target: topic, meta: { source: topic ? 'service' : 'direct' } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  const [currentSubject, setCurrentSubject] = useState<string | null>(() => readSubject(userId));
  /** Composer is dead once this topic is finished. */
  const inputLocked = closed;

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.streaming);
  const askingForDocs = !!lastAssistant && wantsMedia(lastAssistant.text);
  const showAttachCard = askingForDocs && !attachDismissed && !readyToBook && !closed;

  const persistMedia = (next: BookingMedia[]) => {
    setMedia(next);
    try {
      localStorage.setItem(mediaKey(userId), JSON.stringify(next));
    } catch {
      /* ignore */
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
      const localized = localizeNewsPost(post, i18n.language);
      const subject = detectSubject(`${localized.title} ${localized.body ?? ''}`, null);
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

      const body = (localized.body ?? '').slice(0, 800);
      ask(t('chat.newsSeed', { title: localized.title, body }).trim(), false, []);
    }, () => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsId]);

  const startVoice = () => {
    if (!SR || listening || inputLocked) return;
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
    <div dir={isRTL ? 'rtl' : 'ltr'} className="flex h-dvh flex-col bg-cream">
      {/* ── Compact chat header — standard pattern, NO logo ── */}
      <header className="relative shrink-0 overflow-hidden rounded-b-[28px] bg-navy px-5 pb-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <span aria-hidden="true" className="pointer-events-none select-none absolute -bottom-10 -end-3 text-[9rem] font-bold leading-none text-white/5">
          ر
        </span>
        <div className="relative flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={mc.back}
            className="relative -ms-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors active:bg-white/25"
          >
            <AppIcon name="arrow-left" className={`h-6 w-6 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <div className="animate-fade-up min-w-0 flex-1">
            <h1 className="text-[19px] font-extrabold leading-tight text-white">{t('chat.title')}</h1>
            <p className="mt-0.5 text-[12.5px] leading-snug text-white/70">{t('chat.subtitle')}</p>
          </div>
        </div>
        <div className="relative mt-2.5 flex items-center gap-2 flex-wrap">
          {archive.length > 0 && (
            <button onClick={() => setHistoryOpen(true)} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white">
              <AppIcon name="message-circle" className="w-3.5 h-3.5" />
              {t('chat.history.cta', { count: archive.length })}
            </button>
          )}
          {messages.length > 0 && (
            <button onClick={startNewTopic} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white">
              <AppIcon name="plus" className="w-3.5 h-3.5" />
              {t('chat.newTopic')}
            </button>
          )}
        </div>
      </header>

      {/* ── Transcript: dominant, internal scroll only ── */}
      <div ref={scrollRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="animate-fade-up self-start max-w-[85%] rounded-2xl rounded-ss-md bg-brand-blue px-4 py-2.5 text-[14.5px] leading-relaxed text-navy">
          {t('chat.greeting')}
        </div>
        {messages.map((m, i) => (
          <div
            key={`${m.ts}_${i}`}
            className={
              m.role === 'user'
                ? 'animate-pop self-end max-w-[85%] rounded-2xl rounded-se-md bg-navy px-4 py-2.5 text-[14.5px] leading-relaxed text-white break-anywhere'
                : 'animate-pop self-start max-w-[85%] rounded-2xl rounded-ss-md bg-brand-blue px-4 py-2.5 text-[14.5px] leading-relaxed text-navy whitespace-pre-line break-anywhere'
            }
          >
            {m.text}
            {m.streaming && !m.text && (
              <span className="inline-flex gap-1.5 px-0.5 py-1.5" aria-label={t('chat.typing')}>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-navy/40" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-navy/40 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-navy/40 [animation-delay:240ms]" />
              </span>
            )}
            {m.streaming && !!m.text && <span className="ms-1 inline-block h-4 w-0.5 animate-pulse bg-navy/50 align-middle" />}
          </div>
        ))}

        {showAttachCard && <AttachCard onAttach={pickFiles} onSkip={() => setAttachDismissed(true)} uploading={uploading} />}

        {/* topic finished — the assistant stops here until a new one is opened */}
        {closed && <ChatClosedCard booked={closedByBooking} onNewTopic={startNewTopic} />}

        {readyToBook && !booking && !closed && (
          <div className="card animate-pop mt-1.5 w-full max-w-[300px] self-center p-6 text-center" role="status">
            <div className="icon-chip mx-auto">
              <AppIcon name="check-circle" className="w-6 h-6" />
            </div>
            <h2 className="mt-3 text-[16px] font-extrabold text-navy">{t('chat.ready.title')}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{t('chat.ready.body')}</p>
            <button onClick={confirmAppointment} disabled={summarizing} className="btn-primary mt-4 flex min-h-[52px] w-full text-[15px] disabled:opacity-60">
              <AppIcon name="calendar" className="w-4 h-4" />
              {summarizing ? t('chat.ready.preparing') : t('chat.ready.cta')}
            </button>
          </div>
        )}

        {error && (
          <div className="amber-note animate-pop flex max-w-[95%] items-center gap-2.5 self-start" role="alert">
            <AppIcon name="alert-triangle" className="h-[17px] w-[17px] shrink-0" />
            <span className="break-anywhere min-w-0 flex-1 text-[13.5px]">{t(error)}</span>
            {lastFailed && (
              <button type="button" onClick={retry} className="btn-primary min-h-[44px] shrink-0 px-3.5 text-xs">
                {t('chat.retry')}
              </button>
            )}
          </div>
        )}

      </div>

      {/* ── Input bar: pinned above the safe-area bottom inset ── */}
      <div className="shrink-0 border-t border-cream-dark bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        {media.length > 0 && <MediaChips media={media} onRemove={(path) => persistMedia(media.filter((x) => x.path !== path))} />}
        <input ref={fileRef} type="file" accept={ATTACH_ACCEPT} multiple className="hidden" onChange={(e) => onFilesChosen(e.target.files)} />
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={pickFiles}
            disabled={uploading || inputLocked}
            aria-label={t('chat.attach')}
            title={t('chat.attach')}
            className="btn-ghost h-12 w-12 shrink-0 px-0 disabled:opacity-60"
          >
            <AppIcon name={uploading ? 'hourglass' : 'paperclip'} className="h-5 w-5" />
          </button>
          <input
            className="input h-12 min-w-0 flex-1"
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
              className={`btn-ghost h-12 w-12 shrink-0 px-0 disabled:opacity-60 ${listening ? 'text-brand-red' : ''}`}
            >
              <MicGlyph className="h-5 w-5" />
            </button>
          )}
          <button type="button" onClick={send} disabled={busy || inputLocked} className="btn-primary h-12 shrink-0 px-5 text-[14.5px] disabled:opacity-60">
            {t('common.send')}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-gray-500">{t('chat.disclaimer')}</p>
      </div>

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

export function MobilePremium() {
  // The assistant is an intake agent — always requires a signed-in account.
  return (
    <RequireAuth>
      <MobileChatUI />
    </RequireAuth>
  );
}
