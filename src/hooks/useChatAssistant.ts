import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { ai, ApiError, bookings, news, localizeNewsPost, profileApi } from '../lib/api';
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
import { CASE_FILE_DIVIDER } from '../lib/bookingSummary';
import { nextAvailableSlot } from '../lib/scheduling';
import { pickVoice } from '../lib/speechVoice';
import type { BookingMedia, ChatMessage } from '../lib/types';
import { MAX_MEDIA_MB, formatFileList, wantsMedia } from '../components/ChatAttach';
import { SERVICES, pickText } from '../data/services';
import { track } from '../lib/analytics';

/** BCP-47 speech locale per app language — shared by STT (recognition) and TTS (synthesis). */
export const SPEECH_LANG: Record<string, string> = { ar: 'ar-SA', en: 'en-US', ru: 'ru-RU', fa: 'fa-IR' };

export interface UiMessage extends ChatMessage {
  streaming?: boolean;
  /** the assistant signalled it has gathered enough → show the confirm button */
  showConfirm?: boolean;
}

/** In-chat auto-booking card state — seeded once `confirmAppointment()` resolves. */
export interface AutoBookState {
  computedSlot: Date;
  phoneDraft: string;
  phoneNeeded: boolean;
  status: 'idle' | 'saving' | 'error';
  errorMsg: string | null;
}

const chatKey = (userId: string) => `rafiq_chat_history_${userId}`;
const mediaKey = (userId: string) => `rafiq_chat_media_${userId}`;
const voiceModeKey = (userId: string) => `rafiq_voice_mode_${userId}`;

function loadJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '') as T;
  } catch {
    return fallback;
  }
}

/**
 * All state + handlers behind the Premium chat screen, shared by the desktop
 * (`Premium.tsx`) and mobile (`MobilePremium.tsx`) layouts so the intake flow,
 * voice mode and auto-booking logic exist in exactly one place.
 */
export function useChatAssistant() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const userId = user?.id ?? 'guest';

  const [messages, setMessages] = useState<UiMessage[]>(() => loadJson<UiMessage[]>(chatKey(userId), []));
  const [media, setMedia] = useState<BookingMedia[]>(() => loadJson<BookingMedia[]>(mediaKey(userId), []));
  const [input, setInputState] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const [readyToBook, setReadyToBook] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [booking, setBooking] = useState<ChatSummary | null>(null);
  const [autoBook, setAutoBook] = useState<AutoBookState | null>(null);
  const [attachDismissed, setAttachDismissed] = useState(false);
  const [listening, setListening] = useState(false);
  // A topic ends when an appointment is booked — the case is a human's from
  // then on, so the assistant stops replying until a new topic is opened.
  const [closed, setClosedState] = useState(() => readClosed(userId));
  const [closedByBooking, setClosedByBooking] = useState(false);
  const [archive, setArchive] = useState<ArchivedTopic[]>(() => readArchive(userId));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewing, setViewing] = useState<ArchivedTopic | null>(null);
  const [voiceModeOn, setVoiceModeOn] = useState(() => loadJson<boolean>(voiceModeKey(userId), false));
  const [speaking, setSpeaking] = useState(false);
  const [preparingSpeech, setPreparingSpeech] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** which ?topic= has already been seeded, so switching services reseeds */
  const seededRef = useRef<string | null>(null);

  const [sp] = useSearchParams();
  const topic = sp.get('topic');
  const newsId = sp.get('news');
  const step = sp.get('step');
  /** situation-suggestion id (see SituationSuggestions) — swaps the generic topicSeed for the exact suggested question */
  const askId = sp.get('ask');

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
  const showAttachCard = askingForDocs && !attachDismissed && !readyToBook && !closed;

  // ---- voice (STT input + TTS output) ---------------------------------------

  // Web Speech API (browser-dependent). Only show the mic button if supported.
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const voiceSupported = !!SR;
  // Cloud TTS (the primary path) only needs fetch + Audio() — universal in any
  // real browser. window.speechSynthesis (checked separately below where it's
  // used) is just the offline/failure fallback, so it doesn't gate this.
  const ttsSupported = typeof window !== 'undefined' && typeof Audio !== 'undefined';
  const browserVoiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Installed system voices load asynchronously on most browsers — cache them
  // in a ref (not state) since `speak()` only needs the latest list, not a re-render.
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!browserVoiceSupported) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cloud TTS audio playback + guard against a stale fetch resolving after a
  // newer speak()/stopSpeaking() call (network response order isn't guaranteed).
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakTokenRef = useRef(0);

  const stopSpeaking = () => {
    speakTokenRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (browserVoiceSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    setSpeaking(false);
    setPreparingSpeech(false);
  };

  /** Same-device fallback voice, used only when the cloud TTS call fails. */
  const speakWithBrowserVoice = (text: string) => {
    if (!browserVoiceSupported) return;
    try {
      const bcp47 = SPEECH_LANG[i18n.language] ?? 'en-US';
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = bcp47;
      const voice = pickVoice(voicesRef.current, bcp47);
      if (voice) utter.voice = voice;
      // A touch slower than the 1.0 default reads less harsh/robotic on the
      // compact offline voices most OSes fall back to when no natural voice
      // for the language is installed.
      utter.rate = 0.95;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    } catch {
      setSpeaking(false);
    }
  };

  /**
   * Speaks the FULL reply once it has landed — never the word-by-word
   * streaming partials. Prefers real Gemini TTS (same voice for every
   * visitor regardless of what's installed on their device); if that call
   * fails (no key, quota, offline) it falls back to the browser's own voice
   * rather than staying silent.
   */
  const speak = async (text: string) => {
    if (!voiceModeOn || !text.trim()) return;
    stopSpeaking();
    const token = speakTokenRef.current;
    // Cloud TTS generation takes a few seconds — flag it so the UI can show
    // "preparing audio" instead of looking stuck between the text landing and
    // the voice actually starting.
    setPreparingSpeech(true);
    try {
      const url = await ai.speak(text);
      if (speakTokenRef.current !== token) return; // interrupted while awaiting
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => {
        setPreparingSpeech(false);
        setSpeaking(true);
      };
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => {
        setPreparingSpeech(false);
        setSpeaking(false);
      };
      await audio.play();
    } catch {
      if (speakTokenRef.current !== token) return; // interrupted while awaiting
      setPreparingSpeech(false);
      speakWithBrowserVoice(text);
    }
  };

  const toggleVoiceMode = () => {
    setVoiceModeOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(voiceModeKey(userId), JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      if (!next) stopSpeaking();
      return next;
    });
  };

  /** Typing or re-recording interrupts anything currently being read aloud. */
  const setInput = (value: string) => {
    if (speaking) stopSpeaking();
    setInputState(value);
  };

  const startVoice = () => {
    if (!SR || listening || inputLocked || speaking) return;
    stopSpeaking();
    setError(null);
    const recognition = new SR();
    recognition.lang = SPEECH_LANG[i18n.language] ?? 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event: any) => setInputState(event.results[0][0].transcript);
    recognition.onend = () => setListening(false);
    recognition.onerror = (event: any) => {
      setListening(false);
      setError(event?.error === 'not-allowed' ? 'chat.voiceErrorPermission' : 'chat.voiceErrorGeneric');
    };
    setListening(true);
    recognition.start();
  };

  const persistMedia = (next: BookingMedia[]) => {
    setMedia(next);
    try {
      localStorage.setItem(mediaKey(userId), JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  };

  const removeMedia = (path: string) => persistMedia(media.filter((x) => x.path !== path));

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
    stopSpeaking();
    archiveCurrent(closedByBooking);
    setMessages([]);
    persistMedia([]);
    setError(null);
    setBooking(null);
    setAutoBook(null);
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
    stopSpeaking();
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
        { name: user?.name ?? null, phone: user?.phone ?? null, situation: user?.situation ?? null },
        // Start TTS generation (the slow step) the instant the real reply is
        // known, in parallel with the word-by-word typing animation below —
        // not after it, which used to stack both delays back to back.
        (fullReply) => speak(fullReply),
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
    setInputState('');
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

  /** Kick off the case-file summary, then seed the in-chat auto-booking card. */
  const confirmAppointment = async () => {
    if (summarizing) return;
    setSummarizing(true);
    try {
      const transcript = messages.filter((m) => !m.streaming).map(({ role, text, ts }) => ({ role, text, ts }));
      const result = await ai.summarize(transcript, i18n.language);
      setBooking(result);
      setAutoBook({
        computedSlot: nextAvailableSlot(),
        phoneDraft: user?.phone ?? '',
        phoneNeeded: !user?.phone,
        status: 'idle',
        errorMsg: null,
      });
    } finally {
      setSummarizing(false);
    }
  };

  const setAutoBookPhone = (phone: string) => setAutoBook((s) => (s ? { ...s, phoneDraft: phone } : s));

  /** Escape hatch: drop the auto-book card so `<BookingModal>` opens for manual date/time entry. */
  const switchToManualBooking = () => setAutoBook(null);

  /** Dismiss the manual `<BookingModal>` (its own cancel/close button) without booking anything. */
  const closeBooking = () => setBooking(null);

  const onBookingPlaced = () => {
    // The appointment is placed — the case now belongs to a human.
    setClosedState(true);
    setClosedByBooking(true);
    persistClosed(userId, true);
    setReadyToBook(false);
    setBooking(null);
    setAutoBook(null);
  };

  /** Confirm the auto-computed slot straight from the chat — no form to open. */
  const confirmAutoBooking = async () => {
    if (!booking || !autoBook || autoBook.status === 'saving') return;
    const phone = autoBook.phoneDraft.trim();
    if (autoBook.phoneNeeded && phone.length < 6) return;

    setAutoBook((s) => (s ? { ...s, status: 'saving', errorMsg: null } : s));
    try {
      if (autoBook.phoneNeeded && phone) {
        try {
          await profileApi.setPhone(phone);
        } catch {
          /* non-fatal: still send it with the booking below */
        }
      }
      await bookings.create({
        problemSummary: booking.caseFile
          ? `${booking.summary}\n\n${CASE_FILE_DIVIDER}\n${JSON.stringify(booking.caseFile, null, 2)}`
          : booking.summary,
        transcript: messages.filter((m) => !m.streaming).map(({ role, text, ts }) => ({ role, text, ts })),
        preferredDatetime: autoBook.computedSlot.toISOString(),
        preferredLanguage: i18n.language,
        phone: phone || user?.phone || null,
        media,
      });
      onBookingPlaced();
    } catch (e) {
      const past = e instanceof ApiError && e.code === 'past_datetime';
      setAutoBook((s) =>
        s
          ? {
              ...s,
              status: 'error',
              errorMsg: past ? 'chat.autoBook.errorPast' : 'chat.autoBook.errorGeneric',
              computedSlot: past ? nextAvailableSlot() : s.computedSlot,
            }
          : s,
      );
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
    setAutoBook(null);
    setReadyToBook(false);
    setAttachDismissed(false);
    setClosedState(false);
    setClosedByBooking(false);
    persistClosed(userId, false);

    // ?ask=<suggestionId> (from the Services page's situation suggestions) carries
    // the exact question the user tapped — prefer it over the generic topicSeed.
    const askKey = askId ? `services.situationSuggest.questions.${askId}` : '';
    const askText = askKey ? t(askKey, { defaultValue: '' }) : '';
    ask(askText || t('chat.topicSeed', { service: pickText(svc.title, i18n.language) }), false, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  // Step prefill: ?step=<taskKey> (the dashboard's "ask Rafiq about this step"
  // button) seeds the chat with the journey step's own title + description, so
  // the assistant opens straight into that step instead of a blank composer.
  useEffect(() => {
    const seedKey = step ? `step:${step}` : null;
    if (!seedKey || seededRef.current === seedKey) return;
    const title = t(`journeyTasks.${step}.title`, { defaultValue: '' });
    if (!title) return;
    const desc = t(`journeyTasks.${step}.desc`, { defaultValue: '' });
    const subject = detectSubject(`${title} ${desc}`, null);
    setCurrentSubject(subject);
    saveSubject(userId, subject);
    seededRef.current = seedKey;

    if (messages.length > 0) archiveCurrent(closedByBooking);
    persistMedia([]);
    setError(null);
    setBooking(null);
    setAutoBook(null);
    setReadyToBook(false);
    setAttachDismissed(false);
    setClosedState(false);
    setClosedByBooking(false);
    persistClosed(userId, false);

    ask(t('chat.stepSeed', { title, desc }).trim(), false, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

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
      setAutoBook(null);
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

  return {
    messages,
    media,
    input,
    setInput,
    busy,
    uploading,
    error,
    lastFailed,
    readyToBook,
    summarizing,
    booking,
    autoBook,
    attachDismissed,
    setAttachDismissed,
    listening,
    closed,
    closedByBooking,
    archive,
    historyOpen,
    setHistoryOpen,
    viewing,
    setViewing,
    currentSubject,
    scrollRef,
    fileRef,
    inputLocked,
    showAttachCard,
    voiceSupported,
    ttsSupported,
    voiceModeOn,
    toggleVoiceMode,
    speaking,
    preparingSpeech,
    stopSpeaking,
    send,
    retry,
    pickFiles,
    onFilesChosen,
    confirmAppointment,
    confirmAutoBooking,
    setAutoBookPhone,
    switchToManualBooking,
    closeBooking,
    startNewTopic,
    startVoice,
    removeMedia,
    onBookingPlaced,
    deleteArchivedTopic: (id: string) => setArchive(deleteArchived(userId, id)),
  };
}
