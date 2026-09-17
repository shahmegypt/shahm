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
      includeAssets: ['manifest.json', 'offline.html', 'icon-72.png', 'icon-96.png', 'icon-128.png', 'icon-144.png', 'icon-152.png', 'icon-192.png', 'icon-384.png', 'icon-512.png'],
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
          { src: '/icon-72.png', sizes: '72x72', type: 'image/png' },
          { src: '/icon-96.png', sizes: '96x96', type: 'image/png' },
          { src: '/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icon-144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
