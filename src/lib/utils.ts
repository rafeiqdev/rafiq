/**
 * `cn` — the class-name combiner shadcn/ui components expect at `@/lib/utils`.
 *
 * The canonical shadcn helper is `twMerge(clsx(inputs))`, but this project does
 * not depend on `clsx` or `tailwind-merge`, and the only new dependency this
 * integration needs is `lucide-react` (already installed). So this is a small,
 * dependency-free reimplementation of the `clsx` subset our UI primitives use:
 * plain strings and `{ "class": condition }` objects (plus arrays/falsy). It
 * does NOT de-duplicate conflicting Tailwind utilities the way `tailwind-merge`
 * does — if you later add many shadcn components that override classes through
 * `className`, swap the body for `twMerge(clsx(inputs))` and add those two deps.
 */
export type ClassValue =
  | string
  | number
  | null
  | boolean
  | undefined
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === 'string' || typeof input === 'number') {
      out.push(String(input));
    } else if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) out.push(nested);
    } else if (typeof input === 'object') {
      for (const key in input) {
        if (input[key]) out.push(key);
      }
    }
  }

  return out.join(' ');
}
