import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * Top Nav & Service Icons
 * Inspired by Apple SF Symbols: Optical balance, smooth rounded stroke caps & joins, 1.75px stroke width.
 */

export const HomeIcon: React.FC<IconProps> = ({ size = 18, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M3.75 10.5 12 3.75l8.25 6.75v8.5a2 2 0 0 1-2 2h-3.5a1 1 0 0 1-1-1v-4a1.25 1.25 0 0 0-1.25-1.25h-1a1.25 1.25 0 0 0-1.25 1.25v4a1 1 0 0 1-1 1H5.75a2 2 0 0 1-2-2v-8.5Z" />
  </svg>
);

export const AiAssistantIcon: React.FC<IconProps> = ({ size = 18, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="3" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

export const MapIcon: React.FC<IconProps> = ({ size = 18, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M8.75 3.5 2.75 6.5v14l6-3 6.5 3 6-3V3.5l-6 3-6.5-3Z" />
    <path d="M8.75 3.5v14" />
    <path d="M15.25 6.5v14" />
  </svg>
);

export const ServicesGridIcon: React.FC<IconProps> = ({ size = 18, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <rect x="3.5" y="3.5" width="7" height="7" rx="2.25" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2.25" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2.25" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2.25" />
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 16, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/* Sub-service icons */
export const TrekIcon: React.FC<IconProps> = ({ size = 18, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="9.25" />
    <path d="m15.5 8.5-2.6 6.2-6.4 2.6 2.6-6.2 6.4-2.6Z" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" />
  </svg>
);

export const RealEstateIcon: React.FC<IconProps> = ({ size = 18, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M3 21h18" />
    <path d="M5.5 21V7.5L12.5 3l7 4.5V21" />
    <path d="M12.5 3v18" />
    <path d="M9 10h.01" />
    <path d="M9 14h.01" />
    <path d="M9 18h.01" />
    <path d="M16 10h.01" />
    <path d="M16 14h.01" />
    <path d="M16 18h.01" />
  </svg>
);

export const HealthTourismIcon: React.FC<IconProps> = ({ size = 18, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />
    <path d="M12 9v5" />
    <path d="M9.5 11.5h5" />
  </svg>
);

export const InviteEarnIcon: React.FC<IconProps> = ({ size = 18, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <circle cx="8.5" cy="7" r="3.75" />
    <path d="M2.5 20.5v-2a4.5 4.5 0 0 1 4.5-4.5h3a4.5 4.5 0 0 1 4.5 4.5v2" />
    <path d="M18.5 8.5v6" />
    <path d="M21.5 11.5h-6" />
  </svg>
);

export const ResidenceIcon: React.FC<IconProps> = ({ size = 18, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const ArrowLeftIcon: React.FC<IconProps> = ({ size = 16, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.85"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="m11 18-6-6 6-6" />
    <path d="M5 12h14" />
  </svg>
);

export const ArrowRightIcon: React.FC<IconProps> = ({ size = 16, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.85"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="m13 6 6 6-6 6" />
    <path d="M19 12H5" />
  </svg>
);
