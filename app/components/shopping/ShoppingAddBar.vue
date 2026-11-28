<script setup lang="ts">
import { ChevronDownIcon, PlusIcon } from '@lucide/vue'
import type { ShoppingSection } from '~/composables/use-shopping'
import { SHOPPING_ITEM_NAME_MAX, isMultiItemPaste, parseItemLines } from '#shared/shopping-paste'

// Fast entry (features/SHOPPING.md §5): type, Enter, type, Enter — the input keeps focus. Items go to the chosen
// section (a chip; the page remembers it on this device). Pasting several lines adds one item per non-empty line.
// On failure the text comes back (single item) or the error toast offers Retry (several, see useShopping).
const props = defineProps<{
  sections: ShoppingSection[]
  add: (names: string[], sectionId: string | null) => Promise<boolean>
}>()

/** Value of the "no section" option (a select value cannot be null). */
const TOP = ''

/** Chosen section id ('' = no section); owned by the page (a new section becomes the target). */
const storedTarget = defineModel<string>('target', { required: true })

const text = ref('')
const input = useTemplateRef<{ $el: HTMLInputElement } | HTMLInputElement>('input')

// A remembered section that was deleted (or belongs to another household) falls back to the top area.
const target = computed({
  get: () => (props.sections.some(s => s.id === storedTarget.value) ? storedTarget.value : TOP),
  set: (value: string) => {
    storedTarget.value = value
  },
})
const targetName = computed(() => props.sections.find(s => s.id === target.value)?.name ?? 'No section')

function inputEl(): HTMLInputElement | null {
  const el = input.value
  if (!el) {
    return null
  }
  return el instanceof HTMLInputElement ? el : el.$el
}

function focusInput() {
  inputEl()?.focus()
}

async function addNames(names: string[]): Promise<boolean> {
  return props.add(names, target.value === TOP ? null : target.value)
}

async function submit() {
  const names = parseItemLines(text.value)
  if (names.length === 0) {
    return
  }
  // Clear at once so the next item can be typed; put the text back if saving failed and nothing new was typed.
  const typed = text.value
  text.value = ''
  const ok = await addNames(names)
  if (!ok && !text.value) {
    text.value = typed
  }
}

function onPaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData('text/plain') ?? ''
  if (!isMultiItemPaste(pasted)) {
    return
  }
  // Several lines: whatever is in the input (with the paste in place of the selection) becomes the items.
  event.preventDefault()
  const el = inputEl()
  const start = el?.selectionStart ?? text.value.length
  const end = el?.selectionEnd ?? text.value.length
  const names = parseItemLines(text.value.slice(0, start) + pasted + text.value.slice(end))
  text.value = ''
  // On failure the composable's toast offers Retry.
  void addNames(names)
}

function onTargetChange() {
  focusInput()
}
</script>

<template>
  <form novalidate class="flex items-center gap-2" @submit.prevent="submit">
    <label for="shopping-add" class="sr-only">Add an item</label>
    <Input
      id="shopping-add"
      ref="input"
      :model-value="text"
      class="h-11 min-w-0 flex-1"
      placeholder="Add an item…"
      dir="auto"
      autocomplete="off"
      autocapitalize="sentences"
      enterkeyhint="enter"
      :maxlength="SHOPPING_ITEM_NAME_MAX"
      @update:model-value="text = String($event)"
      @paste="onPaste"
    />

    <!-- Target section. Native select: the OS picker is the fastest choice on a phone. -->
    <div class="relative shrink-0">
      <label for="shopping-add-section" class="sr-only">Add to section</label>
      <select
        id="shopping-add-section"
        v-model="target"
        class="h-11 max-w-32 appearance-none truncate rounded-full border border-input bg-muted/60 ps-3 pe-7 text-xs font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-44 dark:bg-input/30"
        dir="auto"
        :title="`Adding to: ${targetName}`"
        @change="onTargetChange"
      >
        <option :value="TOP">
          No section
        </option>
        <option v-for="section in props.sections" :key="section.id" :value="section.id" dir="auto">
          {{ section.name }}
        </option>
      </select>
      <ChevronDownIcon class="pointer-events-none absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>

    <!-- mousedown.prevent: tapping Add must not take focus from the input (the keyboard stays open). -->
    <Button type="submit" size="icon" class="size-11 shrink-0" aria-label="Add item" @mousedown.prevent>
      <PlusIcon class="size-5" />
    </Button>
  </form>
</template>
