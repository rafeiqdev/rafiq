/**
 * "Help is on the way" intro — a short advisor greeting that plays like a GIF:
 * silent, auto-looping, no player controls (no sound bar, nothing to fiddle with),
 * just a moving scene. Centered on a dark card so any orientation fits cleanly.
 */
export function AdvisorScene() {
  return (
    <div className="relative w-fit max-w-full mx-auto rounded-card overflow-hidden bg-black shadow-card border border-cream-dark flex justify-center">
      <video
        src="/scene/advisor.mp4"
        className="max-h-[60vh] w-auto max-w-full pointer-events-none"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
