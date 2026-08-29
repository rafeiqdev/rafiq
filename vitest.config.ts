import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // This runner uses its own config (kept separate from vite.config.ts to skip
  // that file's build-time site-URL gate), so the `@` → `src` alias must be
  // repeated here for shadcn/ui-style `@/...` imports to resolve under vitest.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.{ts,tsx}'],
    env: {
      // src/lib/seo.ts throws without this, and .env is gitignored — so it is
      // absent in CI, where the suite must still run. `.invalid` is reserved by
      // RFC 2606 and can never resolve, so a test value can never be mistaken
      // for a real origin or leak into anything that gets published.
      VITE_BASE_URL: 'https://test.invalid',
    },
  },
});
