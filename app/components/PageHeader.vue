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
    <!-- 44 px touch target, 24 px icon. -->
    <Button
      variant="ghost"
      size="icon"
      class="-me-1.5 size-11 md:hidden"
      aria-label="Household and account"
      @click="accountOpen = true"
    >
      <CircleUserRoundIcon class="size-6" />
    </Button>
  </header>
</template>
