<script setup lang="ts">
import type { InputHTMLAttributes, InputTypeHTMLAttribute } from 'vue'

const props = defineProps<{
  id: string
  label: string
  error?: string
  type?: InputTypeHTMLAttribute
  autocomplete?: string
  inputmode?: InputHTMLAttributes['inputmode']
  placeholder?: string
  maxlength?: number
  autofocus?: boolean
  /** String, not boolean: an absent boolean prop would be cast to `false` and disable spellcheck. */
  spellcheck?: 'true' | 'false'
  autocapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters'
  /**
   * Text direction. Defaults to `auto` so user content typed in Hebrew is right-aligned (D17);
   * pass `ltr` for values that are always Latin (codes, links).
   */
  dir?: 'auto' | 'ltr' | 'rtl'
}>()

const model = defineModel<string>({ required: true })

// The generated shadcn `Input` declares only its own props and passes native attributes through,
// so they are handed over as one typed object instead of individual (untyped) attributes.
const inputAttrs = computed<InputHTMLAttributes>(() => ({
  'id': props.id,
  'type': props.type,
  'autocomplete': props.autocomplete,
  'inputmode': props.inputmode,
  'placeholder': props.placeholder,
  'maxlength': props.maxlength,
  'autofocus': props.autofocus,
  'spellcheck': props.spellcheck,
  'autocapitalize': props.autocapitalize,
  'dir': props.dir ?? 'auto',
  'aria-invalid': props.error ? true : undefined,
  'aria-describedby': props.error ? `${props.id}-error` : undefined,
}))

// The `autofocus` attribute only works on a full page load; focus explicitly so it also works after
// client-side navigation and when a form is swapped in (e.g. onboarding Create/Join).
const root = useTemplateRef<HTMLElement>('root')
onMounted(() => {
  if (props.autofocus) {
    root.value?.querySelector('input')?.focus()
  }
})
</script>

<template>
  <div ref="root" class="space-y-2">
    <label :for="props.id" class="block text-sm font-medium">{{ props.label }}</label>
    <Input
      v-bind="inputAttrs"
      :model-value="model"
      @update:model-value="model = String($event)"
    />
    <p v-if="props.error" :id="`${props.id}-error`" class="text-xs text-destructive">
      {{ props.error }}
    </p>
  </div>
</template>
