import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useChatAssistant } from '../../hooks/useChatAssistant';
import { RequireAuthChat } from '../../components/Gates';
import { BookingModal } from '../../components/BookingModal';
import { AppIcon, BackArrow } from '../../components/AppIcon';
import { MobileTabBar } from '../../components/MobileTabBar';
import { MediaChips, AttachCard, ATTACH_ACCEPT } from '../../components/ChatAttach';
import { ArchivedTopicModal, ChatClosedCard, ChatHistoryModal } from '../../components/ChatHistory';
import { MicGlyph, SpeakerGlyph } from '../../components/ChatVoiceIcons';

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string }> = {
  en: { back: 'Back' },
  ar: { back: 'رجوع' },
  fa: { back: 'بازگشت' },
  ru: { back: 'Назад' },
};

function MobileChatUI() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const c = useChatAssistant();

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="flex h-dvh flex-col bg-cream">
      {/* ── Compact chat header — standard pattern, NO logo ── */}
      <header className="relative shrink-0 overflow-hidden rounded-b-[28px] bg-navy px-5 pb-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <span aria-hidden="true" className="pointer-events-none select-none absolute -bottom-10 -end-3 text-[9rem] font-bold leading-none text-white/5">
          ر
        </span>
        {/* pe-12: the fixed language-switcher badge (see Layout.tsx) floats in
            this corner on top of the header — without room reserved for it, a
            long title ran underneath and got covered. */}
        <div className="relative flex items-center gap-3 pe-12">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={mc.back}
            className="relative -ms-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors active:bg-white/25"
          >
            <BackArrow className="h-6 w-6" />
          </button>
          <div className="animate-fade-up min-w-0 flex-1">
            <h1 className="truncate text-[19px] font-extrabold leading-tight text-white">{t('chat.title')}</h1>
            <p className="mt-0.5 truncate text-[12.5px] leading-snug text-white/70">{t('chat.subtitle')}</p>
          </div>
        </div>
        <div className="relative mt-2.5 flex items-center gap-2 flex-wrap">
          {c.ttsSupported && (
            <button
              onClick={c.toggleVoiceMode}
              aria-pressed={c.voiceModeOn}
              aria-label={t(c.voiceModeOn ? 'chat.voiceModeOn' : 'chat.voiceModeOff')}
              className={`inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold ${c.voiceModeOn ? 'text-brand-red' : 'text-white'}`}
            >
              <SpeakerGlyph className="w-3.5 h-3.5" active={c.speaking} />
              {t('chat.voiceMode')}
            </button>
          )}
          {c.archive.length > 0 && (
            <button onClick={() => c.setHistoryOpen(true)} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white">
              <AppIcon name="message-circle" className="w-3.5 h-3.5" />
              {t('chat.history.cta', { count: c.archive.length })}
            </button>
          )}
          {c.messages.length > 0 && (
            <button onClick={c.startNewTopic} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white">
              <AppIcon name="plus" className="w-3.5 h-3.5" />
              {t('chat.newTopic')}
            </button>
          )}
        </div>
      </header>

      {/* ── Transcript: dominant, internal scroll only ── */}
      <div ref={c.scrollRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="animate-fade-up self-start max-w-[85%] rounded-2xl rounded-ss-md bg-brand-blue px-4 py-2.5 text-[14.5px] leading-relaxed text-navy">
          {t('chat.greeting')}
        </div>
        {c.messages.map((m, i) => (
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

        {c.showAttachCard && <AttachCard onAttach={c.pickFiles} onSkip={() => c.setAttachDismissed(true)} uploading={c.uploading} />}

        {/* topic finished — the assistant stops here until a new one is opened */}
        {c.closed && <ChatClosedCard booked={c.closedByBooking} onNewTopic={c.startNewTopic} />}

        {c.readyToBook && !c.booking && !c.closed && (
          <div className="card animate-pop mt-1.5 w-full max-w-[300px] self-center p-6 text-center" role="status">
            <div className="icon-chip mx-auto">
              <AppIcon name="check-circle" className="w-6 h-6" />
            </div>
            <h2 className="mt-3 text-[16px] font-extrabold text-navy">{t('chat.ready.title')}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{t('chat.ready.body')}</p>
            <button onClick={c.confirmAppointment} disabled={c.summarizing} className="btn-primary mt-4 flex min-h-[52px] w-full text-[15px] disabled:opacity-60">
              <AppIcon name="calendar" className="w-4 h-4" />
              {c.summarizing ? t('chat.ready.preparing') : t('chat.ready.cta')}
            </button>
          </div>
        )}

        {/* case summarized → confirm the auto-picked slot right here, no form */}
        {c.booking && c.autoBook && (
          <div className="card animate-pop mt-1.5 w-full max-w-[320px] self-center p-6 text-center" role="status">
            <div className="icon-chip mx-auto">
              <AppIcon name="calendar" className="w-6 h-6" />
            </div>
            <h2 className="mt-3 text-[16px] font-extrabold text-navy">{t('chat.autoBook.title')}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{t('chat.autoBook.body')}</p>
            <div className="rounded-xl bg-cream px-4 py-3 mt-3 text-start">
              <p className="text-xs font-semibold text-navy/60">{t('chat.autoBook.slotLabel')}</p>
              <p className="mt-1 text-sm font-bold text-navy">
                {new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(c.autoBook.computedSlot)}
              </p>
            </div>
            {c.autoBook.phoneNeeded && (
              <label className="block mt-3 text-xs font-semibold text-navy/70 text-start">
                {t('chat.autoBook.phoneLabel')}
                <input
                  type="tel"
                  dir="ltr"
                  inputMode="tel"
                  className="input mt-1 w-full min-w-0"
                  placeholder="+90 5xx xxx xx xx"
                  value={c.autoBook.phoneDraft}
                  onChange={(e) => c.setAutoBookPhone(e.target.value)}
                />
              </label>
            )}
            {c.autoBook.status === 'error' && c.autoBook.errorMsg && (
              <p role="alert" className="amber-note mt-3 flex items-center gap-2 text-start">
                <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
                {t(c.autoBook.errorMsg)}
              </p>
            )}
            <button
              onClick={c.confirmAutoBooking}
              disabled={c.autoBook.status === 'saving' || (c.autoBook.phoneNeeded && c.autoBook.phoneDraft.trim().length < 6)}
              className="btn-primary mt-4 flex min-h-[52px] w-full text-[15px] disabled:opacity-60"
            >
              <AppIcon name="check-circle" className="w-4 h-4" />
              {c.autoBook.status === 'saving' ? t('chat.autoBook.booking') : t('chat.autoBook.confirm')}
            </button>
            <button onClick={c.switchToManualBooking} className="btn-secondary mt-2 flex min-h-[44px] w-full text-[13px]">
              {t('chat.autoBook.changeTime')}
            </button>
          </div>
        )}

        {c.error && (
          <div className="amber-note animate-pop flex max-w-[95%] items-center gap-2.5 self-start" role="alert">
            <AppIcon name="alert-triangle" className="h-[17px] w-[17px] shrink-0" />
            <span className="break-anywhere min-w-0 flex-1 text-[13.5px]">{t(c.error)}</span>
            {c.lastFailed && (
              <button type="button" onClick={c.retry} className="btn-primary min-h-[44px] shrink-0 px-3.5 text-xs">
                {t('chat.retry')}
              </button>
            )}
          </div>
        )}

      </div>

      {/* ── Input bar: pinned above the bottom tab bar (not the safe-area
          inset alone) — this screen keeps the shared tab bar like every
          other page, so the composer needs room for it, not just the
          notch. ── */}
      <div className="shrink-0 border-t border-cream-dark bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-3">
        {c.media.length > 0 && <MediaChips media={c.media} onRemove={c.removeMedia} />}
        <input ref={c.fileRef} type="file" accept={ATTACH_ACCEPT} multiple className="hidden" onChange={(e) => c.onFilesChosen(e.target.files)} />
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={c.pickFiles}
            disabled={c.uploading || c.inputLocked}
            aria-label={t('chat.attach')}
            title={t('chat.attach')}
            className="btn-ghost h-12 w-12 shrink-0 px-0 disabled:opacity-60"
          >
            <AppIcon name={c.uploading ? 'hourglass' : 'paperclip'} className="h-5 w-5" />
          </button>
          <input
            className="input h-12 min-w-0 flex-1"
            placeholder={t(c.closed ? 'chat.closed.placeholder' : 'chat.placeholder')}
            value={c.input}
            disabled={c.inputLocked}
            onChange={(e) => c.setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && c.send()}
          />
          {c.voiceSupported && (
            <button
              type="button"
              onClick={c.startVoice}
              disabled={c.busy || c.inputLocked || c.speaking}
              aria-label={t('chat.voice')}
              title={t('chat.voice')}
              className={`btn-ghost h-12 w-12 shrink-0 px-0 disabled:opacity-60 ${c.listening ? 'text-brand-red' : ''}`}
            >
              <MicGlyph className="h-5 w-5" />
            </button>
          )}
          <button type="button" onClick={c.send} disabled={c.busy || c.inputLocked} className="btn-primary h-12 shrink-0 px-5 text-[14.5px] disabled:opacity-60">
            {t('common.send')}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-gray-500">{t('chat.disclaimer')}</p>
      </div>

      {c.booking && !c.autoBook && (
        <BookingModal
          problemSummary={c.booking.summary}
          caseFile={c.booking.caseFile}
          transcript={c.messages.filter((m) => !m.streaming).map(({ role, text, ts }) => ({ role, text, ts }))}
          media={c.media}
          onBooked={c.onBookingPlaced}
          onClose={c.closeBooking}
        />
      )}

      {c.historyOpen && (
        <ChatHistoryModal
          topics={c.archive}
          onOpen={(topic) => {
            c.setViewing(topic);
            c.setHistoryOpen(false);
          }}
          onDelete={c.deleteArchivedTopic}
          onClose={() => c.setHistoryOpen(false)}
        />
      )}

      {c.viewing && <ArchivedTopicModal topic={c.viewing} onClose={() => c.setViewing(null)} />}

      <MobileTabBar />
    </div>
  );
}

export function MobilePremium() {
  // The assistant is an intake agent — always requires a signed-in account.
  return (
    <RequireAuthChat>
      <MobileChatUI />
    </RequireAuthChat>
  );
}
