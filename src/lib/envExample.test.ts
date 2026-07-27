import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { glob } from 'node:fs/promises';

/**
 * S4 regression suite — .env.example must document every client-side variable
 * the code actually reads.
 *
 * VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_WHATSAPP_NUMBER were all
 * missing from it. The first two are load-bearing (without them the app renders
 * as a permanently signed-out guest) and the third is the only notification
 * channel to the admin, so a deployer following this file had no way to know
 * any of them existed.
 */

const root = process.cwd();
const envExample = () => readFileSync(join(root, '.env.example'), 'utf8');

/** Every VITE_* name referenced anywhere under src/ or api/. */
async function referencedViteVars(): Promise<Set<string>> {
  const names = new Set<string>();
  for await (const file of glob('{src,api}/**/*.{ts,tsx}', { cwd: root })) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const m of text.matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)) names.add(m[1]);
  }
  return names;
}

describe('.env.example documents the client-side environment', () => {
  it('declares every VITE_* variable the code reads', async () => {
    const declared = new Set(
      envExample()
        .split('\n')
        .map((l) => l.match(/^([A-Z0-9_]+)=/)?.[1])
        .filter((n): n is string => !!n),
    );

    const missing = [...(await referencedViteVars())].filter((n) => !declared.has(n)).sort();

    expect(missing, `undocumented in .env.example: ${missing.join(', ')}`).toEqual([]);
  });

  it.each(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_WHATSAPP_NUMBER'])(
    '%s is present and explains what breaks without it',
    (name) => {
      const src = envExample();
      expect(src).toMatch(new RegExp(`^${name}=`, 'm'));

      // A bare name teaches a deployer nothing: the comment block covering it
      // must state the consequence of leaving it unset. Variables are grouped
      // under a shared block (the two Supabase keys share one), so look back
      // across the group rather than at the immediately preceding line.
      const lines = src.split('\n');
      const at = lines.findIndex((l) => l.startsWith(`${name}=`));
      const preceding = lines
        .slice(Math.max(0, at - 20), at)
        .filter((l) => l.trimStart().startsWith('#'))
        .join(' ')
        .toLowerCase();

      expect(preceding, `${name} has no explanatory comment`).toMatch(
        /without|missing|required|only channel|dead/,
      );
    },
  );

  it('does not invite the service-role key into the client bundle', () => {
    // SUPABASE_SERVICE_ROLE_KEY is server-side and already documented lower
    // down; it must never gain a VITE_ prefix.
    expect(envExample()).not.toMatch(/^VITE_SUPABASE_SERVICE/m);
  });
});
