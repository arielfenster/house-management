<script setup lang="ts">
// Native <select>: the OS picker is the fastest way through ~400 zones on a phone.
const props = defineProps<{
  id: string
  label: string
  error?: string
}>()

const model = defineModel<string>({ required: true })

// Server and browser ICU lists can differ, so the full list is built after mount (no hydration mismatch).
const supported = ref<string[]>([])
onMounted(() => {
  const list = Intl.supportedValuesOf('timeZone')
  supported.value = list.includes('UTC') ? list : ['UTC', ...list]
})

// Always list the current value, even before mount or if this runtime does not know it.
const zones = computed(() => {
  return model.value && !supported.value.includes(model.value) ? [model.value, ...supported.value] : supported.value
})
</script>

<template>
  <div class="space-y-1.5">
    <label :for="props.id" class="text-sm font-medium">{{ props.label }}</label>
    <select
      :id="props.id"
      v-model="model"
      :aria-invalid="props.error ? true : undefined"
      :aria-describedby="props.error ? `${props.id}-error` : undefined"
      class="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-9 w-full rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-3 md:text-sm"
    >
      <option v-for="zone in zones" :key="zone" :value="zone">
        {{ zone.replaceAll('_', ' ') }}
      </option>
    </select>
    <p v-if="props.error" :id="`${props.id}-error`" class="text-xs text-destructive">
      {{ props.error }}
    </p>
  </div>
</template>
