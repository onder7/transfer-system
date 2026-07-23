import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-icon.svg', 'push-sw.js'],
      workbox: { importScripts: ['push-sw.js'] }, // Web Push handler'ları
      devOptions: { enabled: true },       // dev container'da da manifest/SW servis edilsin
      manifest: {
        name: 'Dalaman Transfer',
        short_name: 'Transfer',
        description: 'Havalimanı transfer rezervasyon ve şoför paneli',
        theme_color: '#0f172a',
        background_color: '#f1f5f9',
        display: 'standalone',
        // Şoför giriş yapınca /surucu'ya yönlendirilir; müşteri ana sayfada kalır
        start_url: '/',
        icons: [
          { src: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_BACKEND_URL || 'http://backend:5000', changeOrigin: true },
    },
  },
});
