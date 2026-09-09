import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { resolveSiteUrl } from './scripts/siteUrl.mjs';

/**
 * Meta's domain verification tag.
 *
 * Business Manager -> Brand Safety -> Domains hands out a token and checks for
 * `<meta name="facebook-domain-verification">` in the RAW html — its crawler
 * does not run JavaScript, so this cannot be injected at runtime the way the
 * pixel is. It also cannot live in index.html as a `%VITE_%` placeholder: Vite
 * leaves an unset placeholder in place verbatim, and a tag claiming a
 * verification token of "%VITE_META_DOMAIN_VERIFICATION%" is worse than no tag
 * at all. So the tag is added at build time, and only when a real token exists.
 *
 * Verification is what unlocks controlling which pixel may report conversions
 * for rafiq.ist, so it matters even though the pixel already fires without it.
 */
function metaDomainVerification(token: string): Plugin {
  return {
    name: 'rafiq-meta-domain-verification',
    transformIndexHtml() {
      if (!token) return [];
      return [
        {
          tag: 'meta',
          attrs: { name: 'facebook-domain-verification', content: token },
          injectTo: 'head',
        },
      ];
    },
  };
}

export default defineConfig(({ mode }) => {
  // Fail the BUILD, not the browser. src/lib/seo.ts and index.html's static
  // <head> both bake VITE_BASE_URL in at build time, and neither has a fallback
  // any more — so this is the gate that stops a bundle with a missing or
  // malformed origin from ever being produced. Throwing here aborts `vite build`
  // and `vite dev` with the message from scripts/siteUrl.mjs.
  //
  // loadEnv picks the value up from a .env file locally and from real
  // environment variables on Vercel/CI, which is exactly where each lives.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  resolveSiteUrl(env);

  return {
    plugins: [react(), metaDomainVerification((env.VITE_META_DOMAIN_VERIFICATION ?? '').trim())],
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
