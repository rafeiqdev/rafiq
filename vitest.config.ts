import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    env: {
      // src/lib/seo.ts throws without this, and .env is gitignored — so it is
      // absent in CI, where the suite must still run. `.invalid` is reserved by
      // RFC 2606 and can never resolve, so a test value can never be mistaken
      // for a real origin or leak into anything that gets published.
      VITE_BASE_URL: 'https://test.invalid',
    },
  },
});
