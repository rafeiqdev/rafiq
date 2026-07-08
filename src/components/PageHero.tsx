import type { ReactNode } from 'react';
import { SiteImage } from './SiteImage';

/**
 * Consistent page banner: a real photo background under a navy overlay with a
 * white title/subtitle — used across service pages for one clean, uniform look.
 */
export function PageHero({
  image,
  title,
  subtitle,
  children,
  height = 'min-h-[13rem] sm:min-h-[14rem]',
}: {
  image: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  height?: string;
}) {
  return (
    <div className={`relative rounded-card ${height}`}>
      <div className="absolute inset-0 overflow-hidden rounded-card">
        <SiteImage src={image} alt="" className="w-full h-full" />
      </div>
      <div className="absolute inset-0 bg-navy/75 rounded-card" aria-hidden />
      <div className="relative h-full flex flex-col justify-center px-6 sm:px-10 py-6 text-white">
        <h1 className="text-xl sm:text-3xl font-extrabold drop-shadow break-words">{title}</h1>
        {subtitle && <p className="mt-1 text-white/85 max-w-md text-sm">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
