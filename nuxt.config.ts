import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      // viewport-fit=cover makes env(safe-area-inset-*) non-zero (bottom bar above the iPhone home indicator).
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
    },
  },
  modules: ['@nuxt/eslint', 'shadcn-nuxt', '@nuxtjs/supabase'],
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
  shadcn: {
    prefix: '',
    componentDir: '@/components/ui',
  },
})
