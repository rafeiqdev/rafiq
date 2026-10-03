import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppIcon } from './AppIcon';
import type { IconName } from './AppIcon';

/**
 * The long, crawlable text of a service page — split into coloured section
 * cards (who it is for, documents, key points, duration, rejection reasons,
 * FAQ…) with a jump list on top, so a reader can skim to what matters instead
 * of facing one grey wall of text.
 *
 * The text is still the same markdown-ish string from src/data/serviceSeo*.ts:
 * "## " starts a section, "| … |" lines are a table, "- " / "1. " are lists,
 * "**bold**" works anywhere, and in the FAQ a "**question**" line followed by
 * its answer is one Q&A. Nothing is removed from the DOM when collapsed — the
 * fold is visual only (max-height + fade), so search engines read everything.
 */

export type SectionKind = 'who' | 'documents' | 'important' | 'duration' | 'rejection' | 'faq' | 'other';

interface SectionStyle {
  icon: IconName;
  /** card background + border */
  card: string;
  /** icon chip */
  chip: string;
  /** heading text */
  heading: string;
  /** jump-list chip */
  pill: string;
}

const STYLE: Record<SectionKind, SectionStyle> = {
  who: { icon: 'users', card: 'bg-brand-blue border-navy/15', chip: 'bg-navy text-white', heading: 'text-navy', pill: 'bg-brand-blue text-navy' },
  documents: { icon: 'file-check', card: 'bg-amber-50 border-amber-200', chip: 'bg-amber-500 text-white', heading: 'text-amber-900', pill: 'bg-amber-100 text-amber-900' },
  important: { icon: 'lightbulb', card: 'bg-navy-50 border-navy-100', chip: 'bg-navy-light text-white', heading: 'text-navy-dark', pill: 'bg-navy-100 text-navy-dark' },
  duration: { icon: 'clock', card: 'bg-emerald-50 border-emerald-200', chip: 'bg-emerald-600 text-white', heading: 'text-emerald-900', pill: 'bg-emerald-100 text-emerald-900' },
  rejection: { icon: 'alert-triangle', card: 'bg-red-50 border-red-200', chip: 'bg-brand-red text-white', heading: 'text-red-900', pill: 'bg-red-100 text-red-900' },
  faq: { icon: 'message-circle', card: 'bg-violet-50 border-violet-200', chip: 'bg-violet-600 text-white', heading: 'text-violet-900', pill: 'bg-violet-100 text-violet-900' },
  other: { icon: 'info', card: 'bg-cream border-cream-dark', chip: 'bg-navy/80 text-white', heading: 'text-navy', pill: 'bg-cream-dark text-navy' },
};

/**
 * Which kind a heading is, from the words it uses — in Arabic, English,
 * Russian and Persian, since the four copies were written separately and do
 * not share a heading list. Order matters: "reasons for rejection or delay"
 * must win over the "why" of the eligibility group.
 */
const KIND_PATTERNS: [SectionKind, RegExp][] = [
  ['faq', /أسئلة|سؤال|questions|вопрос|پرسش|سوالات|سؤالات/i],
  ['rejection', /الرفض|رفض|التأخير|مخاطر|rejection|reject|delay|risk|отказ|задерж|риск|دلایل رد|رد یا|خطرات/i],
  ['documents', /مستندات|المستندات|وثائق|الأوراق|المتطلبات|documents|requirements|документ|требован|مدارک|شرایط عمومی/i],
  ['duration', /المدة|الصلاحية|مدة|duration|validity|timeline|срок|مدت|اعتبار/i],
  ['important', /نقاط مهمة|important|key points|what to know|важн|стоит знать|نکات مهم|باید بدانید/i],
  // Any question-shaped or "what matters" heading: eligibility, when you need
  // it, how it works, your rights and obligations, what makes it valid.
  ['who', /من |لمن|متى|لماذا|كيف|ما |هل |الفرق|عوامل|الالتزامات|الحقوق|who|whom|when|why|how|what|can |does|difference|factors|obligations|rights|кто|кому|когда|почему|как|что|какие|каков|чем |может|нужно ли|разница|права|обязатель|чه |چرا|چگونه|کدام|آیا|تفاوت|عوامل|درباره|الزامات|حقوق|نیاز دار/i],
];

export function sectionKind(heading: string): SectionKind {
  for (const [kind, re] of KIND_PATTERNS) if (re.test(heading)) return kind;
  return 'other';
}

export interface BodySection {
  heading: string | null;
  kind: SectionKind;
  blocks: string[];
}

/** Split a body on "## " headings. Text before the first heading becomes an unheaded lead section. */
export function splitSections(body: string): BodySection[] {
  const sections: BodySection[] = [];
  let current: BodySection = { heading: null, kind: 'other', blocks: [] };
  for (const block of body.split('\n\n')) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (/^## /.test(trimmed) && !trimmed.includes('\n')) {
      if (current.heading !== null || current.blocks.length) sections.push(current);
      const heading = trimmed.slice(3).trim();
      current = { heading, kind: sectionKind(heading), blocks: [] };
      continue;
    }
    current.blocks.push(trimmed);
  }
  if (current.heading !== null || current.blocks.length) sections.push(current);
  return sections;
}

/** Renders "**bold**" spans within a line; everything else passes through as-is. */
function renderInline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index} className="font-bold text-navy">{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}

/** One markdown-ish block (table / list / sub-heading / paragraph). */
function Block({ block, kind }: { block: string; kind: SectionKind }) {
  const lines = block.split('\n').filter(Boolean);

  if (lines.length === 1 && lines[0].startsWith('### ')) {
    return <h3 className="pt-1 text-base font-extrabold text-navy">{renderInline(lines[0].slice(4))}</h3>;
  }

  const isTable = lines.length >= 2 && lines.every((line) => line.trim().startsWith('|'));
  if (isTable) {
    const rows = lines
      .map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()))
      .filter((cells) => !cells.every((cell) => /^:?-+:?$/.test(cell)));
    const [head, ...bodyRows] = rows;
    return (
      <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-black/[0.03]">
              {head.map((cell, i) => (
                <th key={i} className="border-b border-gray-200 px-3 py-2 text-start font-bold text-navy">
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((cells, r) => (
              <tr key={r}>
                {cells.map((cell, c) => (
                  <td key={c} className={`border-b border-gray-100 px-3 py-2 ${c === 0 ? 'font-semibold text-navy' : 'text-gray-600'}`}>
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const isBulletList = lines.every((line) => line.startsWith('- '));
  if (isBulletList) {
    return (
      <ul className="space-y-2 text-sm leading-7 text-gray-600">
        {lines.map((line) => (
          <li key={line} className="flex gap-2.5">
            <AppIcon
              name={kind === 'rejection' ? 'x-circle' : 'check'}
              className={`mt-1.5 h-4 w-4 shrink-0 ${kind === 'rejection' ? 'text-brand-red' : 'text-navy'}`}
            />
            <span className="min-w-0">{renderInline(line.slice(2))}</span>
          </li>
        ))}
      </ul>
    );
  }

  const isNumberedList = lines.every((line) => /^\d+\.\s/.test(line));
  if (isNumberedList) {
    return (
      <ol className="list-decimal space-y-1.5 ps-5 text-sm leading-7 text-gray-600">
        {lines.map((line) => (
          <li key={line}>{renderInline(line.replace(/^\d+\.\s/, ''))}</li>
        ))}
      </ol>
    );
  }

  // FAQ: "**question**" on the first line, the answer below it.
  if (kind === 'faq' && lines.length >= 2 && /^\*\*.+\*\*$/.test(lines[0])) {
    return (
      <div className="rounded-xl border border-violet-100 bg-white p-3.5">
        <p className="flex gap-2.5 text-sm font-bold text-navy">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-extrabold text-violet-900">؟</span>
          <span className="min-w-0">{lines[0].slice(2, -2)}</span>
        </p>
        <p className="mt-1.5 ps-[1.9rem] text-sm leading-7 text-gray-600">{renderInline(lines.slice(1).join('\n'))}</p>
      </div>
    );
  }

  return <p className="text-sm leading-7 text-gray-600">{renderInline(block)}</p>;
}

function Section({ section, index, id }: { section: BodySection; index: number; id: string }) {
  const s = STYLE[section.kind];
  if (section.heading === null) {
    return (
      <div className="space-y-3">
        {section.blocks.map((b, i) => (
          <Block key={i} block={b} kind={section.kind} />
        ))}
      </div>
    );
  }
  return (
    <section id={id} className={`scroll-mt-24 rounded-2xl border p-4 sm:p-5 ${s.card}`} data-kind={section.kind} data-testid="service-section">
      <h2 className={`flex items-center gap-3 text-base font-extrabold sm:text-lg ${s.heading}`}>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.chip}`}>
          <AppIcon name={s.icon} className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0">
          <span className="me-2 text-xs font-bold opacity-60">{index + 1}</span>
          {section.heading}
        </span>
      </h2>
      <div className="mt-3 space-y-3">
        {section.blocks.map((b, i) => (
          <Block key={i} block={b} kind={section.kind} />
        ))}
      </div>
    </section>
  );
}

export function ServiceBody({
  body,
  serviceId,
  labels,
  isRtl,
}: {
  body: string;
  serviceId: string;
  labels: { contents: string; readMore: string; readLess: string };
  isRtl: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sections = splitSections(body);
  const headed = sections.filter((s) => s.heading !== null);
  const idFor = (i: number) => `${serviceId}-s${i + 1}`;

  const jump = (i: number) => {
    setExpanded(true);
    // Let the fold open before measuring, or the target is still under the fade.
    window.setTimeout(() => {
      document.getElementById(idFor(i))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  };

  return (
    <section className="card p-5 sm:p-6" dir={isRtl ? 'rtl' : 'ltr'} data-testid="service-body">
      {headed.length > 1 && (
        <nav aria-label={labels.contents} className="mb-4">
          <p className="mb-2 text-xs font-bold text-navy/60">{labels.contents}</p>
          <div className="flex flex-wrap gap-2">
            {headed.map((s, i) => (
              <button
                key={idFor(i)}
                type="button"
                onClick={() => jump(i)}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors hover:opacity-80 ${STYLE[s.kind].pill}`}
              >
                <AppIcon name={STYLE[s.kind].icon} className="h-3.5 w-3.5" />
                {s.heading}
              </button>
            ))}
          </div>
        </nav>
      )}

      <div ref={rootRef} className={`relative space-y-4 overflow-hidden ${expanded ? '' : 'max-h-[30rem]'}`}>
        {(() => {
          let n = -1;
          return sections.map((s, i) => {
            if (s.heading !== null) n += 1;
            return <Section key={i} section={s} index={n} id={idFor(n)} />;
          });
        })()}
        {!expanded && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />}
      </div>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 text-sm font-bold text-gold-dark hover:underline">
        {expanded ? labels.readLess : labels.readMore}
      </button>
    </section>
  );
}
