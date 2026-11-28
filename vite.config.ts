import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the app works both at the custom domain root and at
  // djm0014.github.io/takeoff/ before the domain is pointed at it.
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Bathroom Tools',
        short_name: 'Bath Tools',
        description: 'Field layout tools for bathroom remodels.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#eceeed',
        theme_color: '#1c2321',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The old tools under /legacy are reference copies, not part of the app.
        globIgnores: ['legacy/**'],
        navigateFallbackDenylist: [/^\/legacy\//],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Some tests check the tile planner on hundreds of walls; GitHub's runner is
    // slower than a laptop, and a timed-out test blocks the deploy.
    testTimeout: 60000,
  },
});
