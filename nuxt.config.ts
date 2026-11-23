import tailwindcss from '@tailwindcss/vite'
import { APP_HOME, ROUTES } from './shared/routes'

// --primary (app/assets/css/tailwind.css), also the icon background (scripts/generate-pwa-icons.ts).
const THEME_COLOR = '#171717'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      // viewport-fit=cover makes env(safe-area-inset-*) non-zero (bottom bar above the iPhone home indicator).
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      meta: [
        {
          name: 'theme-color',
          content: THEME_COLOR,
        },
      ],
      link: [
        {
          rel: 'apple-touch-icon',
          href: '/apple-touch-icon-180x180.png',
        },
      ],
    },
  },
  modules: ['@nuxt/eslint', 'shadcn-nuxt', '@nuxtjs/supabase', '@vite-pwa/nuxt'],
  // vue-sonner v2 ships its toast styles separately; without them toasts render invisibly.
  css: ['~/assets/css/tailwind.css', 'vue-sonner/style.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  supabase: {
    // Typed client everywhere: useSupabaseClient() / serverSupabaseClient(event) get this Database type.
    types: '~~/types/database.types.ts',
    // Route protection is implemented by our own middleware in FOUNDATION-008
    // (login -> onboarding -> app), so the module's built-in redirect is off.
    redirect: false,
  },
  pwa: {
    // Our own service worker (push handlers come in Phase 4). @vite-pwa/nuxt v2 rejects `injectManifest` with a
    // TypeScript SW and points to `buildSW`: it bundles service-worker/sw.ts and injects the precache list (D20).
    strategies: 'buildSW',
    buildSW: {
      swSrc: 'service-worker/sw.ts',
      // App shell only: hashed build assets, icons and the manifest. SSR pages are never precached.
      globPatterns: ['**/*.{js,css,png,ico,svg,woff2}'],
    },
    registerType: 'prompt',
    manifest: {
      name: 'House Management',
      short_name: 'House',
      description: 'Tasks, files and shopping for your household.',
      lang: 'en',
      dir: 'ltr',
      start_url: APP_HOME,
      scope: ROUTES.home,
      display: 'standalone',
      orientation: 'portrait',
      theme_color: THEME_COLOR,
      background_color: '#ffffff',
      icons: [
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: 'maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    // The SW is only built for production (`nuxt build`); enable this to debug it under `nuxt dev`.
    devOptions: {
      enabled: false,
    },
  },
  shadcn: {
    prefix: '',
    componentDir: '@/components/ui',
  },
})
