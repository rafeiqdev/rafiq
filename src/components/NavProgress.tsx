import { useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'loading' | 'done';

/**
 * The thin bar along the top edge that appears only while the NEXT page's
 * code is still downloading (see PageTransitionRoutes). Instant navigations
 * never show it; a slow one gets a creeping bar that snaps to full and fades
 * the moment the page is ready. Site chrome, not page content — it renders
 * outside <main> so the page transition never snapshots it.
 */
export function NavProgress({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const wasActive = useRef(false);

  useEffect(() => {
    if (active) {
      wasActive.current = true;
      setPhase('loading');
      return;
    }
    if (!wasActive.current) return;
    wasActive.current = false;
    setPhase('done');
    const timer = window.setTimeout(() => setPhase('idle'), 500);
    return () => window.clearTimeout(timer);
  }, [active]);

  if (phase === 'idle') return null;
  return <div className={`nav-progress nav-progress--${phase}`} aria-hidden="true" />;
}
