import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// PWA installabile ("aggiungi a schermata home"), non app nativa.
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      // injectManifest (non generateSW): il service worker e' nostro, perche'
      // deve gestire l'evento `push` dei promemoria (src/sw.js).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      // La registrazione la fa main.js: cosi' e' esplicita e non ne partono due.
      injectRegister: null,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Notti serene',
        short_name: 'Notti serene',
        description: 'Monitoraggio delle notti, senza colpa e in pochi tap.',
        lang: 'it',
        start_url: '/',
        display: 'standalone',
        background_color: '#f7f5f2',
        theme_color: '#3a5a78',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
