<template>
  <div>
    <!-- @vite-pwa/nuxt: adds the manifest, favicon, apple-touch-icon and theme-color tags to <head>; renders nothing. -->
    <NuxtPwaAssets />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- Phones: above the bottom nav bar (h-16 + safe area), so undo toasts never cover it. -->
    <Toaster :mobile-offset="{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }" />
  </div>
</template>
