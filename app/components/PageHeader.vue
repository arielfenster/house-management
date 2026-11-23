<script setup lang="ts">
import { CircleUserRoundIcon } from '@lucide/vue'

// Small page header: title + 1–2 actions (docs/05-UI-UX-GUIDELINES.md). Also sets the document title.
const props = defineProps<{
  title: string
}>()

useHead({
  title: () => props.title,
})

const accountOpen = useAccountSheetOpen()
</script>

<template>
  <header class="flex h-14 items-center gap-2">
    <h1 class="min-w-0 flex-1 truncate text-lg font-semibold">
      {{ props.title }}
    </h1>
    <slot name="actions" />
    <!-- Desktop opens the account sheet from the sidebar. -->
    <Button
      variant="ghost"
      size="icon"
      class="md:hidden"
      aria-label="Household and account"
      @click="accountOpen = true"
    >
      <CircleUserRoundIcon />
    </Button>
  </header>
</template>
