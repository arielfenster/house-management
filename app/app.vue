<template>
  <div>
    <!-- @vite-pwa/nuxt: adds the manifest, favicon, apple-touch-icon and theme-color tags to <head>; renders nothing. -->
    <NuxtPwaAssets />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- Phones: above the bottom nav bar (h-16 + safe area) and the Tasks page's floating "New task" button,
         so undo toasts never cover either. -->
    <Toaster :mobile-offset="{ bottom: 'calc(8.75rem + env(safe-area-inset-bottom))' }" />
  </div>
</template>
