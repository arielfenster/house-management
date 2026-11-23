<script setup lang="ts">
// Extra attrs (type, autocomplete, dir…) go to the input, not the wrapper.
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  id: string
  label: string
  error?: string
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="space-y-1.5">
    <label :for="props.id" class="text-sm font-medium">{{ props.label }}</label>
    <Input
      :id="props.id"
      v-model="model"
      v-bind="$attrs"
      :aria-invalid="props.error ? true : undefined"
      :aria-describedby="props.error ? `${props.id}-error` : undefined"
    />
    <p v-if="props.error" :id="`${props.id}-error`" class="text-xs text-destructive">
      {{ props.error }}
    </p>
  </div>
</template>
