<script setup lang="ts">
import { PlusIcon } from '@lucide/vue'
import type { ShoppingSection } from '~/composables/use-shopping'
import { SHOPPING_SECTION_NAME_MAX } from '#shared/shopping-paste'
import { checkSectionName } from '#shared/validation/shopping'

// "New section" (features/SHOPPING.md §5): a button that turns into an inline input. Enter creates the section at
// the end; Esc (or leaving it empty) closes it.
const props = defineProps<{
  sections: ShoppingSection[]
  create: (name: string) => Promise<string | null>
}>()

const emit = defineEmits<{
  /** The new section was saved. */
  created: [id: string]
}>()

const open = ref(false)
const name = ref('')
const error = ref('')
const input = useTemplateRef<{ $el: HTMLInputElement }>('input')

async function start() {
  open.value = true
  name.value = ''
  error.value = ''
  await nextTick()
  input.value?.$el.focus()
}

function close() {
  open.value = false
  error.value = ''
}

async function submit() {
  const result = checkSectionName(name.value, props.sections)
  if (!result.ok) {
    error.value = result.error
    return
  }
  close()
  const id = await props.create(result.name)
  if (id) {
    emit('created', id)
  }
}

function onBlur() {
  if (!name.value.trim()) {
    close()
  }
}
</script>

<template>
  <div>
    <Button v-if="!open" variant="ghost" size="sm" class="h-11 text-muted-foreground" @click="start">
      <PlusIcon />
      New section
    </Button>
    <form v-else class="space-y-1" novalidate @submit.prevent="submit" @keydown.esc.stop.prevent="close">
      <label for="shopping-new-section" class="sr-only">New section name</label>
      <div class="flex items-center gap-2">
        <Input
          id="shopping-new-section"
          ref="input"
          :model-value="name"
          class="h-11 min-w-0 flex-1"
          placeholder="Section name, e.g. Produce"
          dir="auto"
          autocomplete="off"
          enterkeyhint="done"
          :maxlength="SHOPPING_SECTION_NAME_MAX"
          :aria-invalid="error ? true : undefined"
          :aria-describedby="error ? 'shopping-new-section-error' : undefined"
          @update:model-value="name = String($event); error = ''"
          @blur="onBlur"
        />
        <Button type="submit" class="h-11" @mousedown.prevent>
          Add section
        </Button>
      </div>
      <p v-if="error" id="shopping-new-section-error" class="text-xs text-destructive">
        {{ error }}
      </p>
    </form>
  </div>
</template>
