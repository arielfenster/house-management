<script setup lang="ts">
import { CheckIcon, PencilIcon, Trash2Icon, XIcon } from '@lucide/vue'
import type { ShoppingSection } from '~/composables/use-shopping'
import { SHOPPING_SECTION_NAME_MAX } from '#shared/shopping-paste'
import { checkSectionName } from '#shared/validation/shopping'

// Section heading (features/SHOPPING.md §6): small uppercase name; the pencil turns it into an inline editor
// (Enter saves, Esc cancels) with a delete button — deleting is undoable from the toast (D16), so no confirm.
const props = defineProps<{
  section: ShoppingSection
  /** All visible sections, for the duplicate-name check. */
  sections: ShoppingSection[]
  rename: (section: ShoppingSection, name: string) => Promise<boolean>
}>()

const emit = defineEmits<{
  delete: []
}>()

const headingId = computed(() => `shopping-section-${props.section.id}`)
const editing = ref(false)
const draft = ref('')
const error = ref('')
const input = useTemplateRef<{ $el: HTMLInputElement }>('input')

async function startEdit() {
  draft.value = props.section.name
  error.value = ''
  editing.value = true
  await nextTick()
  input.value?.$el.focus()
  input.value?.$el.select()
}

function cancel() {
  editing.value = false
  error.value = ''
}

async function save() {
  const result = checkSectionName(draft.value, props.sections, props.section.id)
  if (!result.ok) {
    error.value = result.error
    return
  }
  // Close at once (the rename is optimistic and rolls back with a toast on failure).
  editing.value = false
  await props.rename(props.section, result.name)
}

function remove() {
  editing.value = false
  emit('delete')
}
</script>

<template>
  <div class="border-b border-foreground/10 bg-muted/50">
    <div v-if="!editing" class="flex items-center gap-1 ps-3">
      <h2 :id="headingId" class="min-w-0 flex-1 truncate pt-3 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase" dir="auto">
        {{ props.section.name }}
      </h2>
      <Button
        variant="ghost"
        size="icon"
        class="-my-1 size-11 text-muted-foreground"
        :aria-label="`Edit section ${props.section.name}`"
        :disabled="props.section.pending"
        @click="startEdit"
      >
        <PencilIcon class="size-3.5" />
      </Button>
    </div>

    <form v-else class="space-y-1 p-2" novalidate @submit.prevent="save" @keydown.esc.stop.prevent="cancel">
      <!-- The heading stays in the tree for aria-labelledby while editing. -->
      <h2 :id="headingId" class="sr-only">
        {{ props.section.name }}
      </h2>
      <div class="flex items-center gap-1">
        <label :for="`${headingId}-name`" class="sr-only">Section name</label>
        <Input
          :id="`${headingId}-name`"
          ref="input"
          :model-value="draft"
          class="h-11 min-w-0 flex-1"
          dir="auto"
          autocomplete="off"
          enterkeyhint="done"
          :maxlength="SHOPPING_SECTION_NAME_MAX"
          :aria-invalid="error ? true : undefined"
          :aria-describedby="error ? `${headingId}-error` : undefined"
          @update:model-value="draft = String($event); error = ''"
        />
        <Button type="submit" variant="ghost" size="icon" class="size-11" aria-label="Save name">
          <CheckIcon class="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" class="size-11" aria-label="Cancel" @click="cancel">
          <XIcon class="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-11 text-destructive hover:text-destructive"
          :aria-label="`Delete section ${props.section.name} and its items`"
          @click="remove"
        >
          <Trash2Icon class="size-4" />
        </Button>
      </div>
      <p v-if="error" :id="`${headingId}-error`" class="px-1 text-xs text-destructive">
        {{ error }}
      </p>
    </form>
  </div>
</template>
