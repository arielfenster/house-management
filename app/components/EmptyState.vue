<script setup lang="ts">
// Short, helpful empty state (docs/05-UI-UX-GUIDELINES.md). Optional icon in the default slot, button in #action.
const props = defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center gap-2 py-14 text-center">
    <div v-if="$slots.default" class="mb-1 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
      <slot />
    </div>
    <p class="text-sm font-medium">
      {{ props.title }}
    </p>
    <p v-if="props.description" class="max-w-xs text-sm text-muted-foreground">
      {{ props.description }}
    </p>
    <div v-if="$slots.action" class="mt-2">
      <slot name="action" />
    </div>
  </div>
</template>
