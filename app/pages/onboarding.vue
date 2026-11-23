<script setup lang="ts">
// Placeholder: household create/join UI is FOUNDATION-009.
useHead({ title: 'Set up your household' })
const { signOut } = useAuth()
</script>

<template>
  <main class="mx-auto max-w-sm px-4 py-8">
    <h1 class="mb-2 text-xl font-semibold">
      Set up your household
    </h1>
    <p class="mb-6 text-sm text-muted-foreground">
      Creating or joining a household is coming next.
    </p>
    <Button variant="outline" @click="signOut">
      Log out
    </Button>
  </main>
</template>
