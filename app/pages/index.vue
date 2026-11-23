<script setup lang="ts">
import { APP_HOME } from '#shared/routes'

// `/` has no page of its own (no dashboard): the auth middleware already redirects members to APP_HOME;
// this is the fallback if the page is ever reached.
await navigateTo(APP_HOME, { replace: true })
</script>

<template>
  <div />
</template>
