<script setup lang="ts">
import { CheckIcon, GripVerticalIcon, PencilIcon, Trash2Icon, XIcon } from '@lucide/vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import * as v from 'valibot'
import type { ShoppingItem, ShoppingSection } from '~/composables/use-shopping'
import { SHOPPING_ITEM_NAME_MAX } from '#shared/shopping-paste'
import { shoppingItemNameSchema } from '#shared/validation/shopping'

// Plain shopping row (features/SHOPPING.md §6): square checkbox + name. Ticking shows the check for a moment,
// then the row is removed (the page collapses it; D22). The row is one large tick target — in a store that beats
// precision — so editing has its own pencil at the end, which turns the row into an inline editor
// (Enter saves, Esc cancels, section picker to move it, delete with Undo). In arrange mode (SHOP-008) the row only
// shows its name and a drag handle.
const props = defineProps<{
  item: ShoppingItem
  rename: (item: ShoppingItem, name: string) => Promise<boolean>
  /** Sections to move the item to from the editor. */
  sections: ShoppingSection[]
  arranging: boolean
}>()

const emit = defineEmits<{
  done: []
  delete: []
  /** Moved to another section from the editor (null = no section). */
  move: [sectionId: string | null]
}>()

/** Value of the "no section" option. */
const TOP = ''

/** How long the tick is visible before the row leaves. */
const TICK_MS = 300

const ticking = ref(false)
const reduceMotion = usePreferredReducedMotion()

function onTick() {
  if (ticking.value || props.item.pending) {
    return
  }
  ticking.value = true
  setTimeout(() => {
    emit('done')
  }, reduceMotion.value === 'reduce' ? 0 : TICK_MS)
}

const editing = ref(false)
const draft = ref('')
const error = ref('')
const input = useTemplateRef<{ $el: HTMLInputElement }>('input')
const inputId = computed(() => `shopping-item-${props.item.id}`)

async function startEdit() {
  draft.value = props.item.name
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
  const parsed = v.safeParse(shoppingItemNameSchema, draft.value)
  if (!parsed.success) {
    error.value = parsed.issues[0].message
    return
  }
  // Close at once (the rename is optimistic and rolls back with a toast on failure).
  editing.value = false
  await props.rename(props.item, parsed.output)
}

function remove() {
  editing.value = false
  emit('delete')
}

function onSectionChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  editing.value = false
  emit('move', value === TOP ? null : value)
}

// Leaving arrange mode or starting it closes an open editor.
watch(() => props.arranging, () => {
  editing.value = false
})
</script>

<template>
  <!-- `hover:` only applies on devices that can hover (Tailwind v4), so phones get no sticky highlight. -->
  <li
    class="overflow-hidden border-b border-foreground/10 bg-card last:border-b-0"
    :class="{ 'opacity-60': props.item.pending }"
    :data-id="props.item.id"
    :data-pending="props.item.pending ? '' : undefined"
  >
    <div v-if="props.arranging" class="flex min-h-11 items-center">
      <span class="min-w-0 flex-1 py-2.5 ps-3 text-sm break-words" dir="auto">{{ props.item.name }}</span>
      <!-- touch-none: a drag on the handle never scrolls the page. -->
      <span
        class="drag-handle grid size-11 shrink-0 cursor-grab touch-none place-items-center text-muted-foreground active:cursor-grabbing"
        :aria-label="`Drag to move ${props.item.name}`"
        role="img"
      >
        <GripVerticalIcon class="size-4" />
      </span>
    </div>

    <div v-else-if="!editing" class="flex items-center">
      <button
        type="button"
        role="checkbox"
        :aria-checked="ticking"
        :aria-label="`Got ${props.item.name}`"
        :disabled="props.item.pending"
        class="group flex min-h-11 min-w-0 flex-1 items-center gap-3 ps-3 text-start outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        @click="onTick"
      >
        <span
          class="grid size-5 shrink-0 place-items-center rounded-[5px] border-2 border-muted-foreground/40 transition-colors group-hover:border-primary group-aria-checked:border-primary group-aria-checked:bg-primary"
          aria-hidden="true"
        >
          <CheckIcon class="size-3.5 stroke-3 text-primary-foreground opacity-0 transition-opacity group-aria-checked:opacity-100" />
        </span>
        <span
          class="min-w-0 flex-1 py-2.5 text-sm break-words transition-colors"
          dir="auto"
          :class="{ 'text-muted-foreground line-through': ticking }"
        >
          {{ props.item.name }}
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon"
        class="size-11 shrink-0 rounded-none text-muted-foreground/70"
        :aria-label="`Edit ${props.item.name}`"
        :disabled="props.item.pending || ticking"
        @click="startEdit"
      >
        <PencilIcon class="size-3.5" />
      </Button>
    </div>

    <form v-else class="space-y-1 bg-muted/40 p-1.5" novalidate @submit.prevent="save" @keydown.esc.stop.prevent="cancel">
      <div class="flex items-center gap-1">
        <label :for="inputId" class="sr-only">Item name</label>
        <Input
          :id="inputId"
          ref="input"
          :model-value="draft"
          class="h-11 min-w-0 flex-1"
          dir="auto"
          autocomplete="off"
          enterkeyhint="done"
          :maxlength="SHOPPING_ITEM_NAME_MAX"
          :aria-invalid="error ? true : undefined"
          :aria-describedby="error ? `${inputId}-error` : undefined"
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
          :aria-label="`Delete ${props.item.name}`"
          @click="remove"
        >
          <Trash2Icon class="size-4" />
        </Button>
      </div>
      <p v-if="error" :id="`${inputId}-error`" class="px-1 text-xs text-destructive">
        {{ error }}
      </p>
      <div class="flex items-center gap-2 px-1 pt-0.5">
        <label :for="`${inputId}-section`" class="text-xs text-muted-foreground">Section</label>
        <select
          :id="`${inputId}-section`"
          :value="props.item.sectionId ?? TOP"
          class="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          dir="auto"
          @change="onSectionChange"
        >
          <option :value="TOP">
            No section
          </option>
          <option v-for="section in props.sections" :key="section.id" :value="section.id" dir="auto">
            {{ section.name }}
          </option>
        </select>
      </div>
    </form>
  </li>
</template>
