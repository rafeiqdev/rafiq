export function Logo({
  size = 40,
  variant = 'navy',
  className = '',
}: {
  size?: number;
  variant?: 'navy' | 'white';
  className?: string;
}) {
  // The logo is a wide wordmark; `size` sets its height, width follows aspect ratio.
  // `white` recolors the navy artwork to white for dark backgrounds.
  return (
    <img
      src="/logo-rafiq.webp"
      alt="Rafiq Istanbul"
      style={{ height: size, width: 'auto' }}
      className={`shrink-0 ${variant === 'white' ? 'brightness-0 invert' : ''} ${className}`.trim()}
    />
  );
}
