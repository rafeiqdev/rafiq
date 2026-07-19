import { useTranslation } from 'react-i18next';
import type { ArchivedTopic } from '../lib/chatHistory';
import { AppIcon } from './AppIcon';
import { Modal } from './Modal';

function formatDay(ts: number, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
      new Date(ts),
    );
  } catch {
    return new Date(ts).toLocaleString();
  }
}

/**
 * Shown once a topic is finished — after an appointment is booked the case
 * belongs to a human, so the assistant stops replying here.
 */
export function ChatClosedCard({ booked, onNewTopic }: { booked: boolean; onNewTopic: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="self-center card p-5 text-center max-w-sm" role="status">
      <div className="icon-chip mx-auto">
        <AppIcon name={booked ? 'check-circle' : 'message-circle'} className="w-6 h-6" />
      </div>
      <h2 className="mt-3 font-extrabold text-navy">{t(booked ? 'chat.closed.bookedTitle' : 'chat.closed.title')}</h2>
      <p className="mt-1 text-sm text-gray-500">{t(booked ? 'chat.closed.bookedBody' : 'chat.closed.body')}</p>
      <button onClick={onNewTopic} className="btn-primary w-full mt-4">
        <AppIcon name="plus" className="w-4 h-4" />
        {t('chat.closed.cta')}
      </button>
    </div>
  );
}

/** List of past conversations; selecting one opens it read-only. */
export function ChatHistoryModal({
  topics,
  onOpen,
  onDelete,
  onClose,
}: {
  topics: ArchivedTopic[];
  onOpen: (topic: ArchivedTopic) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <Modal onClose={onClose} labelId="chat-history-title">
      <div className="p-5">
        <h2 id="chat-history-title" className="text-lg font-extrabold text-navy">
          {t('chat.history.title')}
        </h2>

        {topics.length === 0 ? (
          <div className="py-10 text-center">
            <div className="icon-chip mx-auto">
              <AppIcon name="message-circle" className="w-5 h-5" />
            </div>
            <p className="mt-3 text-sm text-gray-500">{t('chat.history.empty')}</p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2 max-h-[60vh] overflow-y-auto overscroll-contain">
            {topics.map((topic) => (
              <li key={topic.id} className="flex items-center gap-2 rounded-xl bg-cream p-3">
                <button onClick={() => onOpen(topic)} className="flex-1 min-w-0 text-start">
                  <p className="truncate text-sm font-bold text-navy">{topic.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatDay(topic.closedAt, i18n.language)}
                    {' · '}
                    {t('chat.history.messages', { count: topic.messages.length })}
                    {topic.booked && ` · ${t('chat.history.booked')}`}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(topic.id)}
                  aria-label={t('common.delete')}
                  className="shrink-0 px-2 text-navy/40 hover:text-brand-red"
                >
                  <AppIcon name="trash" className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button onClick={onClose} className="btn-secondary w-full mt-5">
          {t('common.close')}
        </button>
      </div>
    </Modal>
  );
}

/** Read-only view of one archived conversation. */
export function ArchivedTopicModal({ topic, onClose }: { topic: ArchivedTopic; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <Modal onClose={onClose} labelId="archived-topic-title">
      <div className="p-5">
        <h2 id="archived-topic-title" className="text-base font-extrabold text-navy break-anywhere">
          {topic.title}
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {formatDay(topic.closedAt, i18n.language)}
          {topic.booked && ` · ${t('chat.history.booked')}`}
        </p>

        <div className="mt-4 flex flex-col gap-2 max-h-[55vh] overflow-y-auto overscroll-contain">
          {topic.messages.map((m, i) => (
            <div
              key={`${m.ts}_${i}`}
              className={
                m.role === 'user'
                  ? 'self-end max-w-[85%] rounded-2xl rounded-se-sm bg-navy px-3.5 py-2.5 text-sm text-white break-anywhere'
                  : 'self-start max-w-[85%] rounded-2xl rounded-ss-sm bg-brand-blue px-3.5 py-2.5 text-sm text-navy whitespace-pre-line break-anywhere'
              }
            >
              {m.text}
            </div>
          ))}
        </div>

        {topic.media.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">{t('chat.attached', { count: topic.media.length })}</p>
        )}

        <button onClick={onClose} className="btn-secondary w-full mt-5">
          {t('common.close')}
        </button>
      </div>
    </Modal>
  );
}
