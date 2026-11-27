<script setup lang="ts">
import { CheckIcon, ChevronDownIcon, PencilIcon, PlusIcon, XIcon } from '@lucide/vue'
import type { TaskListResult, TaskListValue } from '~/composables/use-task-list'

/**
 * Pick a value, or create one inline without leaving the form (docs/05 "Creatable select", TASKS-008).
 * Opens as a panel below the field (no nested popup inside a bottom sheet): search box, "None", the values,
 * and "Add “…”" when the search text is new. The new value is selected automatically. Each value can be
 * renamed or deleted from its pencil button.
 */
const props = defineProps<{
  id: string
  label: string
  options: TaskListValue[]
  create: (name: string) => Promise<TaskListResult>
  rename: (id: string, name: string) => Promise<TaskListResult>
  remove: (id: string) => Promise<string | null>
  noneLabel?: string
  /** What deleting a value does to records using it, shown in the delete confirmation. */
  deleteHint?: string
}>()

const emit = defineEmits<{
  /** A value was renamed or deleted (records showing its name may need a refresh). */
  changed: []
}>()

const model = defineModel<string>({ required: true })

const open = ref(false)
const query = ref('')
const error = ref('')
const busy = ref(false)
/** Value being renamed, and whether its delete confirmation is showing. */
const editing = ref<{ id: string, name: string, confirmDelete: boolean } | null>(null)
const panel = useTemplateRef<HTMLElement>('panel')

const selected = computed(() => props.options.find(o => o.id === model.value) ?? null)
const normalizedQuery = computed(() => query.value.trim())
const filtered = computed(() => {
  const q = normalizedQuery.value.toLocaleLowerCase()
  return q ? props.options.filter(o => o.name.toLocaleLowerCase().includes(q)) : props.options
})
const exactMatch = computed(() =>
  props.options.find(o => o.name.toLocaleLowerCase() === normalizedQuery.value.toLocaleLowerCase()) ?? null,
)
const canCreate = computed(() => normalizedQuery.value !== '' && !exactMatch.value)

function toggle() {
  open.value = !open.value
  query.value = ''
  error.value = ''
  editing.value = null
  if (open.value) {
    void nextTick(() => panel.value?.querySelector('input')?.focus())
  }
}

function choose(id: string) {
  model.value = id
  open.value = false
  query.value = ''
  error.value = ''
}

async function createFromQuery() {
  if (!canCreate.value || busy.value) {
    return
  }
  busy.value = true
  const result = await props.create(normalizedQuery.value)
  busy.value = false
  if (!result.ok) {
    error.value = result.message
    return
  }
  choose(result.value.id)
}

/** Enter in the search box: pick the exact match, else create it. Never submits the surrounding form. */
function onEnter() {
  if (exactMatch.value) {
    choose(exactMatch.value.id)
  } else {
    void createFromQuery()
  }
}

function startEdit(option: TaskListValue) {
  editing.value = { id: option.id, name: option.name, confirmDelete: false }
  error.value = ''
}

async function saveRename() {
  if (!editing.value || busy.value) {
    return
  }
  busy.value = true
  const result = await props.rename(editing.value.id, editing.value.name)
  busy.value = false
  if (!result.ok) {
    error.value = result.message
    return
  }
  editing.value = null
  error.value = ''
  emit('changed')
}

async function confirmDelete() {
  if (!editing.value || busy.value) {
    return
  }
  const id = editing.value.id
  busy.value = true
  const message = await props.remove(id)
  busy.value = false
  if (message) {
    error.value = message
    return
  }
  if (model.value === id) {
    model.value = ''
  }
  editing.value = null
  error.value = ''
  emit('changed')
}

const optionClass = 'flex h-10 w-full min-w-0 items-center gap-2 rounded-sm px-2 text-start text-sm outline-none hover:bg-muted focus-visible:bg-muted'
</script>

<template>
  <div class="space-y-2">
    <label :id="`${props.id}-label`" :for="props.id" class="block text-sm font-medium">{{ props.label }}</label>
    <button
      :id="props.id"
      type="button"
      :aria-labelledby="`${props.id}-label ${props.id}-value`"
      :aria-expanded="open"
      :aria-controls="`${props.id}-panel`"
      class="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-3 md:text-sm"
      @click="toggle"
    >
      <span :id="`${props.id}-value`" class="truncate" dir="auto" :class="{ 'text-muted-foreground': !selected }">
        {{ selected?.name ?? props.noneLabel ?? 'None' }}
      </span>
      <ChevronDownIcon class="size-4 shrink-0 opacity-50 transition-transform" :class="{ 'rotate-180': open }" aria-hidden="true" />
    </button>

    <!-- Esc closes this panel only, not the surrounding sheet. -->
    <div
      v-if="open"
      :id="`${props.id}-panel`"
      ref="panel"
      class="space-y-1 rounded-md border border-foreground/15 p-1 shadow-xs"
      @keydown.esc.stop.prevent="toggle"
    >
      <Input
        v-model="query"
        :aria-label="`Search or add ${props.label.toLowerCase()}`"
        placeholder="Search or add…"
        dir="auto"
        autocomplete="off"
        enterkeyhint="done"
        class="h-9"
        @keydown.enter.prevent="onEnter"
      />

      <ul role="listbox" :aria-labelledby="`${props.id}-label`" class="max-h-56 overflow-y-auto">
        <li v-if="!normalizedQuery" role="option" :aria-selected="model === ''">
          <button type="button" :class="optionClass" @click="choose('')">
            <span class="flex-1 text-muted-foreground">{{ props.noneLabel ?? 'None' }}</span>
            <CheckIcon v-if="model === ''" class="size-4" aria-hidden="true" />
          </button>
        </li>

        <li v-for="option in filtered" :key="option.id" role="option" :aria-selected="model === option.id">
          <!-- Rename / delete -->
          <div v-if="editing?.id === option.id" class="space-y-2 rounded-sm bg-muted/60 p-2">
            <template v-if="!editing.confirmDelete">
              <Input
                :model-value="editing.name"
                :aria-label="`New name for ${option.name}`"
                dir="auto"
                class="h-9 bg-background"
                @update:model-value="editing && (editing.name = String($event))"
                @keydown.enter.prevent="saveRename"
              />
              <div class="flex items-center gap-1">
                <Button type="button" size="sm" :disabled="busy" @click="saveRename">
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" @click="editing = null">
                  Cancel
                </Button>
                <Button type="button" size="sm" variant="ghost" class="ms-auto text-destructive hover:text-destructive" @click="editing.confirmDelete = true">
                  Delete
                </Button>
              </div>
            </template>
            <template v-else>
              <p class="text-sm">
                Delete “<span dir="auto">{{ option.name }}</span>”?
                <span v-if="props.deleteHint" class="text-muted-foreground">{{ props.deleteHint }}</span>
              </p>
              <div class="flex items-center gap-1">
                <Button type="button" size="sm" variant="destructive" :disabled="busy" @click="confirmDelete">
                  Delete
                </Button>
                <Button type="button" size="sm" variant="ghost" @click="editing.confirmDelete = false">
                  Cancel
                </Button>
              </div>
            </template>
          </div>

          <div v-else class="flex items-center">
            <button type="button" :class="optionClass" @click="choose(option.id)">
              <span class="min-w-0 flex-1 truncate" dir="auto">{{ option.name }}</span>
              <CheckIcon v-if="model === option.id" class="size-4 shrink-0" aria-hidden="true" />
            </button>
            <Button type="button" variant="ghost" size="icon-sm" class="shrink-0 text-muted-foreground" :aria-label="`Rename or delete ${option.name}`" @click="startEdit(option)">
              <PencilIcon />
            </Button>
          </div>
        </li>

        <li v-if="canCreate">
          <button type="button" :class="optionClass" :disabled="busy" @click="createFromQuery">
            <PlusIcon class="size-4 shrink-0" aria-hidden="true" />
            <span class="min-w-0 truncate">Add “<span dir="auto">{{ normalizedQuery }}</span>”</span>
          </button>
        </li>

        <li v-if="normalizedQuery && !filtered.length && !canCreate" class="px-2 py-2 text-sm text-muted-foreground">
          No matches.
        </li>
      </ul>

      <p v-if="error" role="alert" class="flex items-center gap-1 px-2 pb-1 text-xs text-destructive">
        <XIcon class="size-3" aria-hidden="true" />
        {{ error }}
      </p>
    </div>
  </div>
</template>
