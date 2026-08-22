import type { ReactNode, MouseEvent, CSSProperties } from 'react';

export interface TopNavSubItem {
  id: string;
  label: string;
  description?: string;
  href?: string;
  icon?: ReactNode;
  onClick?: (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
}

export interface TopNavItem {
  id: string;
  label: string;
  href?: string;
  icon?: ReactNode;
  isActive?: boolean;
  onClick?: (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  subItems?: TopNavSubItem[];
}

export interface HeroCtaButton {
  label: string;
  href?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  target?: string;
  rel?: string;
  ariaLabel?: string;
  className?: string;
}

export interface RafiqHeroProps {
  /**
   * Path or URL to the background video file.
   */
  videoSrc?: string;

  /**
   * Path or URL to the poster/fallback image.
   */
  posterSrc?: string;

  /**
   * Path or URL to the Rafiq brand logo image.
   */
  logoSrc?: string;

  /**
   * Main headline in English LTR.
   * Default: "What do you need help with in Istanbul?"
   */
  headline?: string;

  /**
   * List of headline phrases to cycle through with animation.
   */
  headlineWords?: string[];

  /**
   * Animation style for the headline:
   * - 'rotate': Fluid vertical slide & blur transition with spring physics (Fast, modern & slick).
   * - 'typing': Snappy character typewriter with blinking cursor.
   * - 'none': Static text without animation.
   * @default 'rotate'
   */
  animationType?: 'rotate' | 'typing' | 'none';

  /**
   * Duration in milliseconds between word rotations (for 'rotate' mode).
   * @default 2400
   */
  rotateDuration?: number;

  /**
   * Whether to enable animation on the headline.
   * Default: true
   */
  enableTypingAnimation?: boolean;

  /**
   * Typing speed in milliseconds per character (for 'typing' mode).
   * Default: 30
   */
  typeSpeed?: number;

  /**
   * Deleting speed in milliseconds per character (for 'typing' mode).
   * Default: 20
   */
  deleteSpeed?: number;

  /**
   * Pause delay before deleting completed word in milliseconds (for 'typing' mode).
   * Default: 1400
   */
  pauseDelay?: number;

  /**
   * Whether the typing animation should loop infinitely.
   * Default: true
   */
  loop?: boolean;

  /**
   * Supporting descriptive text.
   * Default: "Tell us what you need, and we'll connect you with the right guide, service, or expert assistance — clearly, safely, and in your language."
   */
  supportingText?: string;

  /**
   * Primary call to action button ("Get Started").
   */
  primaryCta?: HeroCtaButton;

  /**
   * Secondary call to action button ("Talk to Rafiq").
   */
  secondaryCta?: HeroCtaButton;

  /**
   * Top Glass Navigation Items: Home, Service (with dropdown), Map, AI Assistant.
   */
  topNavItems?: TopNavItem[];

  /**
   * Optional custom CSS class name for root container.
   */
  className?: string;

  /**
   * Optional inline styles for root container.
   */
  style?: CSSProperties;

  /**
   * Enable or disable automatic playback. Default: true.
   */
  autoPlay?: boolean;

  /**
   * Callback if video fails to load or play.
   */
  onVideoError?: () => void;
}

