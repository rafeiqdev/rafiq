import { useEffect, useId, useRef, useState, Fragment } from 'react';
import type { ReactNode } from 'react';
import { GLOSSARY_TERMS } from '../data/glossary';
import type { Lang } from '../lib/types';
import { AppIcon } from './AppIcon';

/**
 * Micro-tooltip for a single complex term (e.g. "Vergi No"). Opens on hover
 * (desktop) or tap (mobile/keyboard) and closes on outside click, blur, or
 * Escape — so it works the same for a mouse, a touchscreen, and a screen
 * reader/keyboard user.
 */
export function TermTooltip({ term, explanation }: { term: ReactNode; explanation: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex items-center gap-0.5 border-b border-dotted border-navy/40 text-inherit"
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {term}
        <AppIcon name="info" className="w-3 h-3 shrink-0 text-navy/50" />
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full start-1/2 z-30 mb-2 w-56 -translate-x-1/2 rtl:translate-x-1/2 rounded-xl bg-navy px-3 py-2 text-start text-xs font-normal leading-relaxed text-white shadow-card"
        >
          {explanation}
          <span className="absolute top-full start-1/2 -mt-px h-2 w-2 -translate-x-1/2 rotate-45 rtl:translate-x-1/2 bg-navy" />
        </span>
      )}
    </span>
  );
}

/**
 * Scans `text` for known Turkish administrative terms (Vergi No, Göç İdaresi,
 * Apostille, ...) and wraps each match in a TermTooltip carrying its
 * plain-language explanation in `lang`. Terms are matched on their Turkish
 * form, which appears verbatim regardless of the surrounding language.
 */
export function annotateGlossaryTerms(text: string, lang: Lang): ReactNode {
  type Piece = { key: string; content: ReactNode };
  let pieces: Piece[] = [{ key: 'root', content: text }];

  for (const term of GLOSSARY_TERMS) {
    const next: Piece[] = [];
    for (const piece of pieces) {
      if (typeof piece.content !== 'string') {
        next.push(piece);
        continue;
      }
      const regex = new RegExp(term.match.source, term.match.flags.includes('g') ? term.match.flags : `${term.match.flags}g`);
      const str = piece.content;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let i = 0;
      while ((match = regex.exec(str))) {
        if (match.index > lastIndex) {
          next.push({ key: `${piece.key}-t${i}`, content: str.slice(lastIndex, match.index) });
        }
        next.push({
          key: `${piece.key}-m${i}`,
          content: <TermTooltip key={`${piece.key}-m${i}`} term={match[0]} explanation={term.explanation[lang]} />,
        });
        lastIndex = match.index + match[0].length;
        i += 1;
        if (match.index === regex.lastIndex) regex.lastIndex += 1;
      }
      if (i === 0) {
        // No match in this piece for this term — keep it unchanged so the
        // next term's pass can still search it.
        next.push(piece);
      } else if (lastIndex < str.length) {
        next.push({ key: `${piece.key}-tail`, content: str.slice(lastIndex) });
      }
    }
    pieces = next;
  }

  return (
    <>
      {pieces.map((p) => (
        <Fragment key={p.key}>{p.content}</Fragment>
      ))}
    </>
  );
}
