<template>
  <div>
    <!-- @vite-pwa/nuxt: adds the manifest, favicon, apple-touch-icon and theme-color tags to <head>; renders nothing. -->
    <NuxtPwaAssets />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Toaster />
  </div>
</template>
