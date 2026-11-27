<script setup lang="ts">
// Multi-line text field styled like Input. dir="auto" by default: user content may be Hebrew (D17).
const props = defineProps<{
  id: string
  label: string
  error?: string
  placeholder?: string
  maxlength?: number
  rows?: number
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="space-y-1.5">
    <label :for="props.id" class="text-sm font-medium">{{ props.label }}</label>
    <textarea
      :id="props.id"
      v-model="model"
      dir="auto"
      :rows="props.rows ?? 3"
      :placeholder="props.placeholder"
      :maxlength="props.maxlength"
      :aria-invalid="props.error ? true : undefined"
      :aria-describedby="props.error ? `${props.id}-error` : undefined"
      class="border-input placeholder:text-muted-foreground dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive w-full resize-y rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:ring-3 md:text-sm"
    />
    <p v-if="props.error" :id="`${props.id}-error`" class="text-xs text-destructive">
      {{ props.error }}
    </p>
  </div>
</template>
