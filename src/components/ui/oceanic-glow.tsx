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
        containerType: "size",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "-3.2cqmin",
          filter: "blur(1.6cqmin)",
          backgroundColor: "#FAF8F0",
          backgroundImage:
            "radial-gradient(circle at 50% 50%, #FAF8F0 0%, #FAF8F0 16.67%, #EFEADB 16.67%, #EFEADB 33.33%, #E8F0FB 33.33%, #E8F0FB 50%, #1A3A6B 50%, #1A3A6B 66.67%, #12294D 66.67%, #12294D 83.33%, #0B1F3A 83.33%, #0B1F3A 100%)",
        }}
      />
    </div>
  )
}

export default GradientBackground;
