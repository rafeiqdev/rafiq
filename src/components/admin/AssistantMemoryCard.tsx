import { useTranslation } from 'react-i18next';
import { adminUsers } from '../../lib/api';
import type { AssistantMemoryResult, AssistantMemoryView, MemoryFacts, MemoryStyle } from '../../lib/assistantMemoryTypes';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { SectionState } from '../SectionState';
import { AppIcon } from '../AppIcon';

/**
 * What the smart assistant knows about one visitor — for the admin only.
 *
 * Two halves: what the person told us (who they are, where they are in the move
 * to Turkey, what they want) and how they communicate in the chat (hurried,
 * anxious, chatty, only passing time…) with a read on how serious they are and
 * advice on how to talk to them. The visitor never sees any of this.
 */
export function AssistantMemoryCard({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const section = useAsyncSection<AssistantMemoryResult>(() => adminUsers.assistantMemory(userId), [userId]);

  return (
    <div className="mt-4 rounded-xl border border-cream-dark bg-white p-4" data-testid="assistant-memory">
      <div className="flex items-start gap-2">
        <AppIcon name="sparkles" className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-navy">{t('admin.assistant.title')}</p>
          <p className="text-xs text-navy/60">{t('admin.assistant.hint')}</p>
        </div>
      </div>

      <SectionState
        section={section}
        title={t('admin.assistant.title')}
        isEmpty={(r) => r.state === 'ready' && r.memory === null}
        empty={<p className="mt-3 text-xs text-gray-500">{t('admin.assistant.empty')}</p>}
      >
        {(result) =>
          result.state === 'not_installed' ? (
            <p role="status" className="amber-note mt-3 text-xs">
              {t('admin.assistant.notInstalled')}
            </p>
          ) : (
            result.memory && <MemoryBody memory={result.memory} />
          )
        }
      </SectionState>
    </div>
  );
}

function Badge({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'blue' | 'cream' | 'red' }) {
  const cls =
    tone === 'red' ? 'bg-brand-red/10 text-brand-red' : tone === 'cream' ? 'bg-cream text-navy' : 'bg-brand-blue text-navy';
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>{children}</span>;
}

function MemoryBody({ memory }: { memory: AssistantMemoryView }) {
  const { t, i18n } = useTranslation();
  const { facts, style } = memory;

  /** A translated value for an enumerated field, falling back to the raw word. */
  const v = (field: string, value: string | undefined) =>
    value ? t(`admin.assistant.v.${field}.${value}`, { defaultValue: value }) : undefined;

  const factRows: [keyof MemoryFacts, string | undefined][] = [
    ['nationality', facts.nationality],
    ['current_city', facts.current_city],
    ['in_turkey_now', facts.in_turkey_now === undefined ? undefined : t(facts.in_turkey_now ? 'admin.assistant.yes' : 'admin.assistant.no')],
    ['arrival_timeframe', facts.arrival_timeframe],
    ['purpose', facts.purpose],
    ['family', facts.family],
    ['budget_note', facts.budget_note],
    ['languages', facts.languages?.join('، ')],
    ['interests', facts.interests?.join('، ')],
    ['services_of_interest', facts.services_of_interest?.join('، ')],
  ];
  const lists: [keyof MemoryFacts, string[] | undefined][] = [
    ['open_questions', facts.open_questions],
    ['notes', facts.notes],
  ];

  return (
    <div className="mt-3 grid gap-4 md:grid-cols-2">
      {/* ---- what they told us ---- */}
      <div>
        <p className="mb-2 text-xs font-bold text-navy">{t('admin.assistant.whatTheyTold')}</p>
        {facts.visitor_type && (
          <div className="mb-2">
            <Badge>{v('visitor_type', facts.visitor_type)}</Badge>
          </div>
        )}
        {facts.summary && <p className="mb-2 text-xs leading-relaxed text-navy break-words">{facts.summary}</p>}
        <dl className="flex flex-col gap-1 text-xs">
          {factRows
            .filter(([, value]) => !!value)
            .map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <dt className="shrink-0 text-gray-500">{t(`admin.assistant.f.${key}`)}</dt>
                <dd className="min-w-0 text-end font-semibold text-navy break-words">{value}</dd>
              </div>
            ))}
        </dl>
        {lists
          .filter(([, items]) => items && items.length > 0)
          .map(([key, items]) => (
            <div key={key} className="mt-2">
              <p className="text-[11px] font-bold text-navy/70">{t(`admin.assistant.f.${key}`)}</p>
              <ul className="mt-1 list-disc ps-4 text-xs text-navy">
                {items!.map((item) => (
                  <li key={item} className="break-words">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        {facts.next_best_action && (
          <p className="mt-2 rounded-lg bg-cream px-3 py-2 text-xs text-navy break-words">
            <span className="font-bold">{t('admin.assistant.f.next_best_action')}: </span>
            {facts.next_best_action}
          </p>
        )}
      </div>

      {/* ---- how they communicate ---- */}
      <div>
        <p className="mb-2 text-xs font-bold text-navy">{t('admin.assistant.howTheyTalk')}</p>
        <StyleBlock style={style} v={v} />
        <p className="mt-3 text-[11px] text-gray-500">
          {t('admin.assistant.messagesRead', { count: memory.messageCount })}
          {memory.lastAnalyzedAt && ` · ${t('admin.assistant.updated', { date: new Date(memory.lastAnalyzedAt).toLocaleString(i18n.language) })}`}
        </p>
      </div>
    </div>
  );
}

function StyleBlock({ style, v }: { style: MemoryStyle; v: (field: string, value: string | undefined) => string | undefined }) {
  const { t } = useTranslation();
  const hurried = style.tempo === 'hurried' || style.urgency === 'high' || style.urgency === 'critical';
  const passing = style.seriousness === 'passing_time' || style.seriousness === 'low';

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap gap-1.5">
        {style.tempo && <Badge tone={style.tempo === 'hurried' ? 'red' : 'blue'}>{v('tempo', style.tempo)}</Badge>}
        {style.seriousness && <Badge tone={passing ? 'cream' : 'blue'}>{v('seriousness', style.seriousness)}</Badge>}
        {style.social_style && <Badge>{v('social_style', style.social_style)}</Badge>}
        {style.detail_preference && <Badge tone="cream">{v('detail_preference', style.detail_preference)}</Badge>}
        {style.tone?.map((tag) => (
          <Badge key={tag} tone="cream">
            {v('tone', tag)}
          </Badge>
        ))}
      </div>

      <dl className="flex flex-col gap-1">
        {style.urgency && (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">{t('admin.assistant.s.urgency')}</dt>
            <dd className={`font-semibold ${hurried ? 'text-brand-red' : 'text-navy'}`}>{v('urgency', style.urgency)}</dd>
          </div>
        )}
        {style.message_length && (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">{t('admin.assistant.s.message_length')}</dt>
            <dd className="font-semibold text-navy">{v('message_length', style.message_length)}</dd>
          </div>
        )}
        {style.confidence && (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">{t('admin.assistant.s.confidence')}</dt>
            <dd className="font-semibold text-navy">{v('confidence', style.confidence)}</dd>
          </div>
        )}
      </dl>

      {typeof style.intent_score === 'number' && (
        <div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">{t('admin.assistant.s.intent_score')}</span>
            <span className="font-bold text-navy" dir="ltr">
              {style.intent_score}%
            </span>
          </div>
          <div
            className="mt-1 h-2 overflow-hidden rounded-full bg-cream-dark"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={style.intent_score}
            aria-label={t('admin.assistant.s.intent_score')}
          >
            <div className="h-full rounded-full bg-navy" style={{ width: `${style.intent_score}%` }} />
          </div>
        </div>
      )}

      {style.signals && style.signals.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-navy/70">{t('admin.assistant.s.signals')}</p>
          <ul className="mt-1 list-disc ps-4 text-navy">
            {style.signals.map((s) => (
              <li key={s} className="break-words">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {style.how_to_talk && (
        <p className="rounded-lg bg-cream px-3 py-2 text-navy break-words">
          <span className="font-bold">{t('admin.assistant.s.how_to_talk')}: </span>
          {style.how_to_talk}
        </p>
      )}
    </div>
  );
}
