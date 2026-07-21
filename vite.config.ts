import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
});
