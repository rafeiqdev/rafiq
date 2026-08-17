import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { resolveSiteUrl } from './scripts/siteUrl.mjs';

export default defineConfig(({ mode }) => {
  // Fail the BUILD, not the browser. src/lib/seo.ts and index.html's static
  // <head> both bake VITE_BASE_URL in at build time, and neither has a fallback
  // any more — so this is the gate that stops a bundle with a missing or
  // malformed origin from ever being produced. Throwing here aborts `vite build`
  // and `vite dev` with the message from scripts/siteUrl.mjs.
  //
  // loadEnv picks the value up from a .env file locally and from real
  // environment variables on Vercel/CI, which is exactly where each lives.
  resolveSiteUrl(loadEnv(mode, process.cwd(), 'VITE_'));

  return {
    plugins: [react()],
    // `@` → `src`, so shadcn/ui-style imports (`@/lib/utils`,
    // `@/components/ui/...`) resolve. Mirrored in tsconfig.app.json (for tsc)
    // and vitest.config.ts (for the test runner, which uses its own config).
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('react-router')) return 'react-router';
            if (id.includes('i18next')) return 'i18next';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('@googlemaps')) return 'google-maps';
            if (/[\\/]react[\\/]|[\\/]react-dom[\\/]/.test(id)) return 'react-vendor';
          },
        },
      },
    },
    server: {
      // host: true binds to 0.0.0.0 so other devices on the same Wi-Fi
      // (a second laptop or your phone) can open the printed "Network" URL.
      host: true,
      port: Number(process.env.PORT) || 5173,
      strictPort: !!process.env.PORT,
      // allow public tunnel domains (cloudflared / ngrok) so Vite doesn't reject
      // them with "Blocked request: This host is not allowed".
      allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.app', '.ngrok.io'],
      proxy: {
        // the phone hits Vite, which forwards /api to the API server on this PC
        '/api': 'http://localhost:8787',
      },
    },
  };
});
