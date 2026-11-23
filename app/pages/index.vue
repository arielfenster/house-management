<script setup lang="ts">
// Placeholder app home: AppShell and `/` → `/tasks` come in FOUNDATION-010.
const { signOut } = useAuth()
</script>

<template>
  <main class="mx-auto max-w-sm px-4 py-8">
    <h1 class="mb-6 text-xl font-semibold">
      Home
    </h1>
    <Button variant="outline" @click="signOut">
      Log out
    </Button>
  </main>
</template>
