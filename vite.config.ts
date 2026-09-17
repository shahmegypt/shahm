import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['manifest.json', 'offline.html'],
      manifest: {
        name: 'شَهْم - نقل الحالات العلاجية',
        short_name: 'شَهْم',
        description: 'منصة تكافلية غير ربحية لنقل الحالات العلاجية',
        start_url: '/',
        display: 'standalone',
        background_color: '#F7F8F9',
        theme_color: '#146B44',
        lang: 'ar',
        dir: 'rtl',
        icons: [
          { src: '/icon-192.jpeg', sizes: '192x192', type: 'image/jpeg' },
          { src: '/icon-512.jpeg', sizes: '512x512', type: 'image/jpeg', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,jpg,jpeg,svg}'],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
