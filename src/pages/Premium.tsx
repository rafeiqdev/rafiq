import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { ai, ApiError } from '../lib/api';
import type { ChatMessage } from '../lib/types';
import { RequireAuth } from '../components/Gates';
import { BookingModal } from '../components/BookingModal';
import { Logo } from '../components/Logo';
import { AppIcon } from '../components/AppIcon';
import { SERVICES, pickText } from '../data/services';

/** BCP-47 speech-recognition locale per app language. */
const SPEECH_LANG: Record<string, string> = { ar: 'ar-SA', en: 'en-US', ru: 'ru-RU', fa: 'fa-IR' };

/** Simple inline microphone glyph (no 'mic' entry in the AppIcon registry). */
function MicGlyph({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  );
}

interface UiMessage extends ChatMessage {
  offerBooking?: boolean;
  problemSummary?: string;
  streaming?: boolean;
}

function chatKey(userId: string) {
  return `rafiq_chat_history_${userId}`;
}

function loadChat(userId: string): UiMessage[] {
  try {
    return JSON.parse(localStorage.getItem(chatKey(userId)) ?? '[]');
  } catch {
    return [];
  }
}

function ChatUI() {
  const { t, i18n } = useTranslation();
  const { user, tier, appConfig } = useApp();
  const userId = user!.id;
  const [messages, setMessages] = useState<UiMessage[]>(() => loadChat(userId));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywalled, setPaywalled] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const [booking, setBooking] = useState<{ summary: string } | null>(null);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);

  const [sp] = useSearchParams();
  const topic = sp.get('topic');

  const isPro = tier === 'pro' || tier === 'elite';

  // Web Speech API (browser-dependent). Only show the mic button if supported.
  const SR =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  useEffect(() => {
    localStorage.setItem(chatKey(userId), JSON.stringify(messages.filter((m) => !m.streaming)));
    // scroll the CHAT BOX internally — never the window (so entering/sending
    // doesn't jerk the whole page down to the bottom).
    const c = scrollRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [messages, userId]);

  const ask = async (text: string, alreadyAppended = false) => {
    setError(null);
    setLastFailed(null);
    setBusy(true);

    const userMsg: UiMessage = { role: 'user', text, ts: Date.now() };
    const history = alreadyAppended ? messages : [...messages, userMsg];
    if (!alreadyAppended) setMessages(history);

    // placeholder bubble that fills as the server streams
    const placeholderTs = Date.now() + 1;
    setMessages((m) => [...m, { role: 'assistant', text: '', ts: placeholderTs, streaming: true }]);

    try {
      const result = await ai.chat(
        history.map(({ role, text: tx, ts }) => ({ role, text: tx, ts })),
        i18n.language,
        (partial) =>
          setMessages((m) => m.map((msg) => (msg.ts === placeholderTs ? { ...msg, text: partial } : msg))),
      );
      setRemaining(result.remaining);
      setMessages((m) => [
        ...m.map((msg) => (msg.ts === placeholderTs ? { ...msg, text: result.reply, streaming: false } : msg)),
        ...(result.offerBooking
          ? [
              {
                role: 'assistant' as const,
                text: `${result.problemSummary}\n\n${t('chat.bookOffer')}`,
                ts: Date.now() + 2,
                offerBooking: true,
                problemSummary: result.problemSummary,
              },
            ]
          : []),
      ]);
    } catch (e) {
      setMessages((m) => m.filter((msg) => msg.ts !== placeholderTs));
      if (e instanceof ApiError && e.status === 402) {
        setPaywalled(true);
      } else {
        setError('chat.error');
        setLastFailed(text);
      }
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text || busy || paywalled) return;
    setInput('');
    ask(text);
  };

  const retry = () => {
    if (lastFailed) ask(lastFailed, true);
  };

  // Topic prefill: if arriving with ?topic=<serviceId> and the chat is empty,
  // auto-send a seeded first message about that service (once).
  useEffect(() => {
    if (seededRef.current) return;
    if (!topic || messages.length > 0) return;
    const svc = SERVICES.find((s) => s.id === topic);
    if (!svc) return;
    seededRef.current = true;
    ask(t('chat.topicSeed', { service: pickText(svc.title, i18n.language) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  const startVoice = () => {
    if (!SR || listening || paywalled) return;
    const recognition = new SR();
    recognition.lang = SPEECH_LANG[i18n.language] ?? 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      setInput(event.results[0][0].transcript);
    };
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
        {!isPro && (
          <span className="rounded-full bg-brand-blue text-navy text-xs font-bold px-3 py-1.5">
            {t('chat.previewLeft', { count: remaining ?? appConfig.freeChatMessages })}
          </span>
        )}
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
            {m.offerBooking && (
              <button onClick={() => setBooking({ summary: m.problemSummary ?? '' })} className="btn-primary w-full mt-3">
                <AppIcon name="calendar" className="w-4 h-4" />
                {t('chat.bookCta')}
              </button>
            )}
          </div>
        ))}
        {error && (
          <div className="self-start max-w-[85%] amber-note flex items-center gap-3" role="alert">
            <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
            <span className="flex-1 min-w-0 break-anywhere">{t(error)}</span>
            <button onClick={retry} className="btn-primary h-8 px-3 text-xs shrink-0">
              {t('chat.retry')}
            </button>
          </div>
        )}
        {paywalled && (
          <div className="self-center card p-5 text-center max-w-sm">
            <div className="icon-chip mx-auto">
              <AppIcon name="sparkles" />
            </div>
            <h2 className="mt-3 font-extrabold text-navy">{t('chat.gate.title')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('chat.gate.body')}</p>
            <Link to="/pricing" className="btn-primary w-full mt-4">
              {t('chat.gate.cta')}
            </Link>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="input h-12 flex-1 min-w-0"
          placeholder={t('chat.placeholder')}
          value={input}
          disabled={paywalled}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        {SR && (
          <button
            type="button"
            onClick={startVoice}
            disabled={busy || paywalled}
            aria-label={t('chat.voice')}
            title={t('chat.voice')}
            className={`btn-ghost h-12 px-3 shrink-0 disabled:opacity-60 ${listening ? 'text-brand-red' : ''}`}
          >
            <MicGlyph className="w-5 h-5" />
          </button>
        )}
        <button onClick={send} disabled={busy || paywalled} className="btn-primary h-12 px-4 sm:px-6 shrink-0 disabled:opacity-60">
          {t('common.send')}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-gray-500">{t('chat.disclaimer')}</p>

      {booking && (
        <BookingModal
          problemSummary={booking.summary}
          transcript={messages.map(({ role, text, ts }) => ({ role, text, ts }))}
          onClose={() => setBooking(null)}
        />
      )}
    </div>
  );
}

export function Premium() {
  return (
    <RequireAuth>
      <ChatUI />
    </RequireAuth>
  );
}
