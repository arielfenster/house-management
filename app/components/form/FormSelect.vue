<script setup lang="ts">
// Native <select> styled like Input: the OS picker is the fastest choice on a phone (as TimezoneSelect).
export interface FormSelectOption {
  value: string
  label: string
}

const props = defineProps<{
  id: string
  label: string
  options: FormSelectOption[]
  error?: string
  /** Visually hidden label (still read by screen readers). */
  hideLabel?: boolean
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="space-y-2">
    <label :for="props.id" class="block text-sm font-medium" :class="{ 'sr-only': props.hideLabel }">{{ props.label }}</label>
    <select
      :id="props.id"
      v-model="model"
      :aria-invalid="props.error ? true : undefined"
      :aria-describedby="props.error ? `${props.id}-error` : undefined"
      class="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-9 w-full rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-3 md:text-sm"
    >
      <option v-for="option in props.options" :key="option.value" :value="option.value" dir="auto">
        {{ option.label }}
      </option>
    </select>
    <p v-if="props.error" :id="`${props.id}-error`" class="text-xs text-destructive">
      {{ props.error }}
    </p>
  </div>
</template>
