import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// All app icons (PWA 64/192/512, maskable, iOS home screen, favicon.ico) are generated from public/favicon.svg
// by @vite-pwa/nuxt at build time and served on the fly in dev. Nothing generated is committed.
// The preset pads maskable/iOS icons with a white background by default; use the app's primary colour instead.
const BACKGROUND = '#171717'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: {
        ...minimal2023Preset.maskable.resizeOptions,
        background: BACKGROUND,
      },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: {
        ...minimal2023Preset.apple.resizeOptions,
        background: BACKGROUND,
      },
    },
  },
  images: ['public/favicon.svg'],
})
