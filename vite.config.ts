import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'offline.html'],
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/functions/v1/'),
            handler: 'NetworkOnly',
            method: 'POST'
          }
        ]
      },
      manifest: {
        name: 'Võluvatt Coupons',
        short_name: 'Võluvatt',
        description: 'One-time QR reward redemption for Võluvatt cotton candy.',
        theme_color: '#151E50',
        background_color: '#FFF7FB',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/scan',
        scope: '/',
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ]
});
