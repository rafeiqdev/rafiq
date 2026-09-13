// components/ui/oceanic-glow.tsx

// GradientBackground — "Oceanic Glow", made with the 21st.dev Gradient
// Builder and exported as live CSS.
// Zero dependencies: one <div> that fills its parent.
//
// Usage:
// <div className="relative h-96">
//   <GradientBackground className="absolute inset-0" />
// </div>
//
// Source:
// https://21st.dev/community/gradients/editor?from=cacc0131-a5ac-42e3-9577-1c52f540ac11

export function GradientBackground({
  className,
}: {
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        overflow: "hidden",
        width: "100%",
        height: "100%",
      }}
    >
      {/* Lightened 2026-09-13: the banded rings used to be softened with a
          live `filter: blur()` over the whole section, which every phone GPU
          had to rasterise (and re-rasterise on resize / DPR change). The same
          look is now baked into the gradient itself — each hard band edge
          gets a ~1.4% feather — so this is one plain paint, no filter. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#FAF8F0",
          backgroundImage:
            "radial-gradient(circle at 50% 50%, #FAF8F0 0%, #FAF8F0 15.97%, #EFEADB 17.37%, #EFEADB 32.63%, #E8F0FB 34.03%, #E8F0FB 49.3%, #1A3A6B 50.7%, #1A3A6B 65.97%, #12294D 67.37%, #12294D 82.63%, #0B1F3A 84.03%, #0B1F3A 100%)",
        }}
      />
    </div>
  )
}

export default GradientBackground;
