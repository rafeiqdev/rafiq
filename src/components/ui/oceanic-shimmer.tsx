// components/ui/oceanic-shimmer.tsx

// GradientBackground — "Oceanic Shimmer", made with the 21st.dev Gradient
// Builder and exported as live CSS (the builder's own Copy-CSS background,
// plus its soften-blur and grain passes). Zero dependencies: one <div> that
// fills its parent. Drop it behind your content:
// <div className="relative h-96"><GradientBackground className="absolute inset-0" /></div>
//
// Remix the source recipe in the editor:
// https://21st.dev/community/gradients/editor?from=edd345b3-bbfc-488d-9798-87a22acf7276

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
          inset: 0,
          backgroundColor: "#1A3A6B",
          backgroundImage:
            "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.215'/></svg>\"), radial-gradient(150% 48.4% at 41.58% 6%, rgba(250, 248, 240, 0.92) 0%, rgba(250, 248, 240, 0) 53%), radial-gradient(150% 48.4% at 42.42% 33%, rgba(232, 240, 251, 0.92) 0%, rgba(232, 240, 251, 0) 53%), radial-gradient(150% 48.4% at 51.19% 67%, rgba(26, 58, 107, 0.92) 0%, rgba(26, 58, 107, 0) 53%), radial-gradient(150% 48.4% at 53.67% 94%, rgba(18, 41, 77, 0.92) 0%, rgba(18, 41, 77, 0) 53%)",
          backgroundSize: "120px 120px, auto, auto, auto, auto",
          backgroundBlendMode:
            "overlay, normal, normal, normal, normal",
        }}
      />

      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.215,
          mixBlendMode: "overlay",
        }}
      >
        <filter id="grain-edd345b3">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>

        <rect
          width="100%"
          height="100%"
          filter="url(#grain-edd345b3)"
        />
      </svg>
    </div>
  )
}
