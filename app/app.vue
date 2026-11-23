<template>
  <div>
    <!-- Adds <link rel="manifest"> (@vite-pwa/nuxt); renders nothing. -->
    <NuxtPwaManifest />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Toaster />
  </div>
</template>
