/**
 * `cn` — the class-name combiner shadcn/ui components expect at `@/lib/utils`.
 *
 * Upgraded to the canonical `twMerge(clsx(inputs))` (the homepage-v2 port
 * brought in enough shadcn-style components — button, verified-badge, the
 * RafiqHero tree — that Tailwind class conflicts through `className` overrides
 * became common; `clsx`/`tailwind-merge` are now real dependencies).
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type { ClassValue };

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
