<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center px-4 py-8">
    <div class="w-full max-w-sm">
      <h1 class="mb-6 text-xl font-semibold">
        {{ title }}
      </h1>
      <slot />
      <p class="mt-6 text-center text-sm text-muted-foreground">
        <slot name="footer" />
      </p>
    </div>
  </main>
</template>
