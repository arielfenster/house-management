<script setup lang="ts">
import { PlusIcon } from '@lucide/vue'
import { SHOPPING_ITEM_NAME_MAX, isMultiItemPaste, parseItemLines } from '#shared/shopping-paste'

// SHOP-008a: "+ Add an item" at the end of a section (or the top area). Tap turns it into an input in place; Enter
// adds to the end of that section and keeps focus (rapid entry); a multi-line paste adds every line there; Esc or
// leaving it empty closes it. A failed single add puts the text back; a failed paste offers Retry (useShopping).
const props = defineProps<{
  /** Section to add to (null = the top area). */
  sectionId: string | null
  /** Used in the input's accessible name. */
  sectionName: string
  add: (names: string[], sectionId: string | null) => Promise<boolean>
}>()

const open = ref(false)
const text = ref('')
const input = useTemplateRef<{ $el: HTMLInputElement }>('input')
const inputId = computed(() => `shopping-inline-add-${props.sectionId ?? 'top'}`)

async function start() {
  open.value = true
  text.value = ''
  await nextTick()
  input.value?.$el.focus()
}

function close() {
  open.value = false
  text.value = ''
}

async function submit() {
  const names = parseItemLines(text.value)
  if (names.length === 0) {
    return
  }
  // Clear at once so the next item can be typed; put the text back if saving failed and nothing new was typed.
  const typed = text.value
  text.value = ''
  const ok = await props.add(names, props.sectionId)
  if (!ok && !text.value) {
    text.value = typed
  }
}

function onPaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData('text/plain') ?? ''
  if (!isMultiItemPaste(pasted)) {
    return
  }
  event.preventDefault()
  const el = input.value?.$el
  const start = el?.selectionStart ?? text.value.length
  const end = el?.selectionEnd ?? text.value.length
  const names = parseItemLines(text.value.slice(0, start) + pasted + text.value.slice(end))
  text.value = ''
  // On failure the composable's toast offers Retry.
  void props.add(names, props.sectionId)
}

function onBlur() {
  if (!text.value.trim()) {
    close()
  }
}
</script>

<template>
  <div class="border-t border-foreground/10">
    <button
      v-if="!open"
      type="button"
      class="flex min-h-11 w-full items-center gap-3 px-3 text-start text-sm text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      :aria-label="`Add an item to ${props.sectionName}`"
      @click="start"
    >
      <PlusIcon class="size-4 shrink-0" aria-hidden="true" />
      Add an item
    </button>
    <form v-else class="p-1.5" novalidate @submit.prevent="submit" @keydown.esc.stop.prevent="close">
      <label :for="inputId" class="sr-only">New item in {{ props.sectionName }}</label>
      <Input
        :id="inputId"
        ref="input"
        :model-value="text"
        class="h-11"
        placeholder="Add an item…"
        dir="auto"
        autocomplete="off"
        autocapitalize="sentences"
        enterkeyhint="enter"
        :maxlength="SHOPPING_ITEM_NAME_MAX"
        @update:model-value="text = String($event)"
        @paste="onPaste"
        @blur="onBlur"
      />
    </form>
  </div>
</template>
