import { useTranslation } from 'react-i18next';
import { useChatAssistant } from '../hooks/useChatAssistant';
import { useApp } from '../context/AppContext';
import { useCatalog } from '../data/catalogStore';
import { RequireAuthChat } from '../components/Gates';
import { BookingModal } from '../components/BookingModal';
import { Logo } from '../components/Logo';
import { AppIcon } from '../components/AppIcon';
import { MediaChips, AttachCard, ATTACH_ACCEPT } from '../components/ChatAttach';
import { ArchivedTopicModal, ChatClosedCard, ChatHistoryModal } from '../components/ChatHistory';
import { SituationSuggestions } from '../components/SituationSuggestions';
import { MicGlyph, SpeakerGlyph } from '../components/ChatVoiceIcons';

function ChatUI() {
  const { t, i18n } = useTranslation();
  const c = useChatAssistant();
  const { profile } = useApp();
  const { services } = useCatalog();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col" style={{ minHeight: 'calc(100vh - 8rem)' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <Logo size={44} />
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-navy">{t('chat.title')}</h1>
          <p className="text-sm text-navy/70">{t('chat.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {c.ttsSupported && (
            <button
              onClick={c.toggleVoiceMode}
              aria-pressed={c.voiceModeOn}
              aria-label={t(c.preparingSpeech ? 'chat.voicePreparing' : c.voiceModeOn ? 'chat.voiceModeOn' : 'chat.voiceModeOff')}
              title={t(c.preparingSpeech ? 'chat.voicePreparing' : c.voiceModeOn ? 'chat.voiceModeOn' : 'chat.voiceModeOff')}
              className={`btn-secondary !h-9 px-3 text-xs ${c.voiceModeOn ? 'text-brand-red' : ''} ${c.preparingSpeech ? 'animate-pulse' : ''}`}
            >
              <SpeakerGlyph className="w-3.5 h-3.5" active={c.speaking} />
              {t('chat.voiceMode')}
            </button>
          )}
          {c.archive.length > 0 && (
            <button onClick={() => c.setHistoryOpen(true)} className="btn-secondary !h-9 px-3 text-xs">
              <AppIcon name="message-circle" className="w-3.5 h-3.5" />
              {t('chat.history.cta', { count: c.archive.length })}
            </button>
          )}
          {c.messages.length > 0 && (
            <button onClick={c.startNewTopic} className="btn-secondary !h-9 px-3 text-xs">
              <AppIcon name="plus" className="w-3.5 h-3.5" />
              {t('chat.newTopic')}
            </button>
          )}
        </div>
      </div>

      <div ref={c.scrollRef} className="card flex-1 mt-5 p-4 overflow-y-auto overscroll-contain flex flex-col gap-3" style={{ maxHeight: '55vh', minHeight: '40vh' }}>
        <div className="self-start max-w-[85%] rounded-2xl rounded-ss-sm bg-brand-blue px-4 py-3 text-sm text-navy">
          {t('chat.greeting')}
        </div>

        {/* Fresh conversation: offer situation-tailored questions to open a topic in one tap. */}
        {c.messages.length === 0 && !c.closed && (
          <SituationSuggestions situation={profile.situation} services={services} variant="chat" />
        )}

        {c.messages.map((m, i) => (
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
        {c.showAttachCard && (
          <AttachCard onAttach={c.pickFiles} onSkip={() => c.setAttachDismissed(true)} uploading={c.uploading} />
        )}

        {/* topic finished — the assistant stops here until a new one is opened */}
        {c.closed && <ChatClosedCard booked={c.closedByBooking} onNewTopic={c.startNewTopic} />}

        {/* the assistant has everything → offer to confirm an appointment */}
        {c.readyToBook && !c.booking && !c.closed && (
          <div className="self-center card p-5 text-center max-w-sm" role="status">
            <div className="icon-chip mx-auto">
              <AppIcon name="check-circle" className="w-6 h-6" />
            </div>
            <h2 className="mt-3 font-extrabold text-navy">{t('chat.ready.title')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('chat.ready.body')}</p>
            <button onClick={c.confirmAppointment} disabled={c.summarizing} className="btn-primary w-full mt-4 disabled:opacity-60">
              <AppIcon name="calendar" className="w-4 h-4" />
              {c.summarizing ? t('chat.ready.preparing') : t('chat.ready.cta')}
            </button>
          </div>
        )}

        {/* case summarized → confirm the auto-picked slot right here, no form */}
        {c.booking && c.autoBook && (
          <div className="self-center card p-5 text-center max-w-sm" role="status">
            <div className="icon-chip mx-auto">
              <AppIcon name="calendar" className="w-6 h-6" />
            </div>
            <h2 className="mt-3 font-extrabold text-navy">{t('chat.autoBook.title')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('chat.autoBook.body')}</p>
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
              className="btn-primary w-full mt-4 disabled:opacity-60"
            >
              <AppIcon name="check-circle" className="w-4 h-4" />
              {c.autoBook.status === 'saving' ? t('chat.autoBook.booking') : t('chat.autoBook.confirm')}
            </button>
            <button onClick={c.switchToManualBooking} className="btn-secondary w-full mt-2">
              {t('chat.autoBook.changeTime')}
            </button>
          </div>
        )}

        {c.error && (
          <div className="self-start max-w-[85%] amber-note flex items-center gap-3" role="alert">
            <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
            <span className="flex-1 min-w-0 break-anywhere">{t(c.error)}</span>
            {c.lastFailed && (
              <button onClick={c.retry} className="btn-primary h-8 px-3 text-xs shrink-0">
                {t('chat.retry')}
              </button>
            )}
          </div>
        )}

      </div>

      {/* attached files */}
      {c.media.length > 0 && (
        <MediaChips media={c.media} onRemove={c.removeMedia} />
      )}

      <input ref={c.fileRef} type="file" accept={ATTACH_ACCEPT} multiple className="hidden" onChange={(e) => c.onFilesChosen(e.target.files)} />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={c.pickFiles}
          disabled={c.uploading || c.inputLocked}
          aria-label={t('chat.attach')}
          title={t('chat.attach')}
          className="btn-ghost h-12 px-3 shrink-0 disabled:opacity-60"
        >
          <AppIcon name={c.uploading ? 'hourglass' : 'paperclip'} className="w-5 h-5" />
        </button>
        <input
          className="input h-12 flex-1 min-w-0"
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
            className={`btn-ghost h-12 px-3 shrink-0 disabled:opacity-60 ${c.listening ? 'text-brand-red' : ''}`}
          >
            <MicGlyph className="w-5 h-5" />
          </button>
        )}
        <button onClick={c.send} disabled={c.busy || c.inputLocked} className="btn-primary h-12 px-4 sm:px-6 shrink-0 disabled:opacity-60">
          {t('common.send')}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-gray-500">{t('chat.disclaimer')}</p>

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
    </div>
  );
}

export function Premium() {
  // The assistant is an intake agent that collects a case for a human specialist,
  // so it always requires a signed-in account (name + phone come from it).
  return (
    <RequireAuthChat>
      <ChatUI />
    </RequireAuthChat>
  );
}
