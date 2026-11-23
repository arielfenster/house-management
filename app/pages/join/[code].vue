<script setup lang="ts">
import { INVITE_CODE_QUERY, ROUTES } from '#shared/routes'

// Invite link `/join/<code>`: the global middleware has already handled signed-out users (login, then
// back here) and members (sent to the app). Everyone else continues on onboarding with the code filled in.
const route = useRoute()
const code = String(route.params.code ?? '')

await navigateTo(
  {
    path: ROUTES.onboarding,
    query: { [INVITE_CODE_QUERY]: code },
  },
  { replace: true },
)
</script>

<template>
  <div />
</template>
