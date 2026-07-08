import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { AppIcon, DirArrow } from '../components/AppIcon';
import { AdvisorScene } from '../components/AdvisorScene';
import { BookingModal } from '../components/BookingModal';

/**
 * Friendly "help is on the way" landing reached from every "Help me with this"
 * CTA. Shows the animated advisor + car over Istanbul, then offers two paths:
 * a free human appointment, or the AI assistant.
 */
export function HelpRequest() {
  const { t } = useTranslation();
  const { user } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const topic = params.get('topic') ?? '';
  const [booking, setBooking] = useState(false);

  const summary = topic ? `Help request — ${topic}` : 'Help request';

  const wantHelp = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setBooking(true);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="text-center max-w-prose mx-auto animate-fade-up">
        <span className="eyebrow">{t('help.eyebrow')}</span>
        <h1 className="section-title mt-2">{t('help.title')}</h1>
        <p className="mt-3 text-navy/70">{t('help.body')}</p>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button onClick={() => navigate('/services')} className="btn-secondary btn-lg w-full sm:w-auto">
          <AppIcon name="file-text" className="w-5 h-5" />
          {t('help.selfGuide')}
        </button>
        <button onClick={() => navigate('/premium')} className="btn-primary btn-lg w-full sm:w-auto">
          <AppIcon name="message-circle" className="w-5 h-5" />
          {t('help.askAi')}
        </button>
        <button onClick={wantHelp} className="btn-gold btn-lg w-full sm:w-auto">
          <AppIcon name="users" className="w-5 h-5" />
          {t('help.yes')}
          <DirArrow className="w-4 h-4" />
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-navy/50">{t('help.note')}</p>

      <div className="mt-8 animate-fade-in">
        <AdvisorScene />
        <p className="mt-3 text-center text-sm text-navy/60">{t('help.sceneCaption')}</p>
      </div>

      {booking && <BookingModal problemSummary={summary} transcript={[]} onClose={() => setBooking(false)} />}
    </div>
  );
}
