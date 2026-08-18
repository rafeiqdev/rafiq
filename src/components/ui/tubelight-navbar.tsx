import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
// Registry code ships this as `@/lib/utils`; this repo uses relative imports.
import { cn } from '../../lib/utils';

/*
 * "Tubelight" navbar — a rounded pill of links with a spring-animated lamp glow
 * sliding under the active item (the layoutId="lamp" motion element).
 *
 * Adapted from the shadcn/Next.js original for THIS app:
 *  - next/link  → react-router <Link to>, and "use client" dropped (Vite SPA).
 *  - active state is derived from the ACTUAL route (useLocation), not just the
 *    last click — the original was a local tab widget, but here every item is a
 *    real destination, so the lamp must land on the page you're actually on.
 *  - shadcn theme tokens (bg-background / border-border / text-primary / bg-muted)
 *    don't exist in this project, so it's repainted with the app's own tokens
 *    (navy / cream-dark / white).
 *  - a `variant="inline"` was added so the bar can flow inside a page (the
 *    signed-in home uses it in place of the old quick-links row) instead of
 *    always floating fixed over the mobile tab bar.
 */

export interface NavItem {
  name: string;
  /** react-router path, e.g. "/map". Kept named `url` to match the original API. */
  url: string;
  icon: LucideIcon;
}

interface NavBarProps {
  items: NavItem[];
  className?: string;
  /**
   * `fixed` (default) keeps the original behaviour: a floating pill pinned
   * bottom-center on phones / top-center on desktop. `inline` drops the fixed
   * positioning so the bar sits in normal page flow.
   */
  variant?: 'fixed' | 'inline';
}

const isRouteActive = (pathname: string, url: string) =>
  url === '/' ? pathname === '/' : pathname.startsWith(url);

export function NavBar({ items, className, variant = 'fixed' }: NavBarProps) {
  const { pathname } = useLocation();

  // The lamp follows the ACTUAL route — it lights the item you're on, and
  // NOTHING when the current page isn't in the list. That last part matters:
  // on phones this bar drops the destinations the bottom tab bar already carries
  // (Home, Services), so none of the items left is "here" — and lighting one
  // anyway would fake a "you are here" on a page you're not on.
  const activeName = items.find((i) => isRouteActive(pathname, i.url))?.name;

  return (
    <div
      className={cn(
        variant === 'fixed'
          ? 'fixed bottom-0 sm:top-0 left-1/2 -translate-x-1/2 z-50 mb-6 sm:pt-6'
          : 'inline-flex max-w-full',
        className,
      )}
    >
      <div className="flex items-center gap-1 sm:gap-2 bg-white/90 border border-cream-dark backdrop-blur-lg py-1 px-1 rounded-full shadow-card overflow-x-auto scrollbar-none">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.name === activeName;

          return (
            <Link
              key={item.name}
              to={item.url}
              className={cn(
                'relative cursor-pointer text-sm font-semibold px-4 sm:px-6 py-2 rounded-full transition-colors whitespace-nowrap',
                'text-navy/70 hover:text-navy',
                isActive && 'text-navy',
              )}
            >
              <span className="hidden md:inline">{item.name}</span>
              <span className="md:hidden">
                <Icon size={18} strokeWidth={2.5} />
              </span>
              {isActive && (
                <motion.div
                  layoutId="lamp"
                  className="absolute inset-0 w-full bg-navy/5 rounded-full -z-10"
                  initial={false}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-navy rounded-t-full">
                    <div className="absolute w-12 h-6 bg-navy/20 rounded-full blur-md -top-2 -left-2" />
                    <div className="absolute w-8 h-6 bg-navy/20 rounded-full blur-md -top-1" />
                    <div className="absolute w-4 h-4 bg-navy/20 rounded-full blur-sm top-0 left-2" />
                  </div>
                </motion.div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
