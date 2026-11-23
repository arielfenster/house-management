/// <reference lib="webworker" />
// Our own service worker, compiled by @vite-pwa/nuxt (`buildSW` strategy, see nuxt.config.ts and D20).
// Phase 0 scope (docs/02-ARCHITECTURE.md "PWA strategy"): precache the built app shell (hashed JS/CSS,
// icons, manifest) and nothing else. No navigation fallback: pages are server-rendered and need a session.
// No runtime caching: `/api/*` and Supabase requests always go to the network.
// Push and notificationclick handlers are added here in Phase 4.
import { clientsClaim } from '@vite-pwa/workbox-swkit/core'
import { cleanupOutdatedCaches, precacheAndRoute } from '@vite-pwa/workbox-swkit/precaching'

declare const self: ServiceWorkerGlobalScope

// Replaced at build time with the list of files to precache.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Activate a new version right away. Only hashed assets are cached, so an open page keeps working;
// it picks up the new assets on its next navigation. Nothing reloads under the user.
self.skipWaiting()
clientsClaim()
