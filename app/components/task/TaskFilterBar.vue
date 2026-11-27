<script setup lang="ts">
import { SearchIcon, XIcon } from '@lucide/vue'
import { useEventListener } from '@vueuse/core'
import type { TaskListValue } from '~/composables/use-task-list'
import { activeFacetCount, type OpenTaskStatusFilter, type TaskStatusFilter } from '#shared/task-filter'

// Status tabs, search box and category/room/type filters for the task list (TASKS-009).
// Search and filters are opened from the page header; state lives in useTaskFilters.
const props = defineProps<{
  /** Open-task counts per status (with facets and search applied). */
  counts: Record<OpenTaskStatusFilter, number>
  categories: TaskListValue[]
  rooms: TaskListValue[]
}>()

const { status, facets, searchOpen, filtersOpen, clearFacets } = useTaskFilters()

const TABS: { value: TaskStatusFilter, label: string }[] = [
  {
    value: 'all',
    label: 'All',
  },
  {
    value: 'upcoming',
    label: 'Upcoming',
  },
  {
    value: 'overdue',
    label: 'Overdue',
  },
  {
    value: 'completed',
    label: 'Done',
  },
]

function count(tab: TaskStatusFilter): number | null {
  return tab === 'completed' ? null : props.counts[tab]
}

const categoryOptions = computed(() => [
  {
    value: '',
    label: 'Any category',
  },
  ...props.categories.map(c => ({
    value: c.id,
    label: c.name,
  })),
])
const roomOptions = computed(() => [
  {
    value: '',
    label: 'Any room',
  },
  ...props.rooms.map(r => ({
    value: r.id,
    label: r.name,
  })),
])
const KIND_OPTIONS = [
  {
    value: '',
    label: 'Any type',
  },
  {
    value: 'one_time',
    label: 'One-time',
  },
  {
    value: 'recurring',
    label: 'Repeating',
  },
]

// The selects work with strings; '' means "any".
const categoryId = computed({
  get: () => facets.value.categoryId ?? '',
  set: (value: string) => {
    facets.value = { ...facets.value, categoryId: value || null }
  },
})
const roomId = computed({
  get: () => facets.value.roomId ?? '',
  set: (value: string) => {
    facets.value = { ...facets.value, roomId: value || null }
  },
})
const kind = computed({
  get: () => facets.value.kind ?? '',
  set: (value: string) => {
    facets.value = { ...facets.value, kind: value === 'one_time' || value === 'recurring' ? value : null }
  },
})
const query = computed({
  get: () => facets.value.query,
  set: (value: string) => {
    facets.value = { ...facets.value, query: value }
  },
})

const searchRow = useTemplateRef<HTMLElement>('searchRow')
watch(searchOpen, (open) => {
  if (open) {
    void nextTick(() => searchRow.value?.querySelector('input')?.focus())
  }
})

function closeSearch() {
  query.value = ''
  searchOpen.value = false
}

// Desktop: "/" or Ctrl/Cmd+K opens and focuses search (docs/05), unless already typing somewhere.
if (import.meta.client) {
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    const typing = target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')
    if ((event.key === '/' && !typing) || (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey))) {
      event.preventDefault()
      if (searchOpen.value) {
        searchRow.value?.querySelector('input')?.focus()
      } else {
        searchOpen.value = true
      }
    }
  })
}
</script>

<template>
  <div class="space-y-2">
    <div class="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Show">
      <Button
        v-for="tab in TABS"
        :key="tab.value"
        type="button"
        size="sm"
        :variant="status === tab.value ? 'outline' : 'ghost'"
        :aria-pressed="status === tab.value"
        class="gap-1 px-1"
        @click="status = tab.value"
      >
        {{ tab.label }}
        <span v-if="count(tab.value) !== null" class="text-xs font-normal text-muted-foreground tabular-nums">{{ count(tab.value) }}</span>
      </Button>
    </div>

    <div v-if="searchOpen" ref="searchRow" class="relative">
      <SearchIcon class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        v-model="query"
        type="search"
        aria-label="Search tasks"
        placeholder="Search tasks…"
        dir="auto"
        autocomplete="off"
        enterkeyhint="search"
        class="h-10 ps-9 pe-10"
        @keydown.esc="closeSearch"
      />
      <Button type="button" variant="ghost" size="icon-sm" class="absolute end-1 top-1/2 -translate-y-1/2" aria-label="Close search" @click="closeSearch">
        <XIcon />
      </Button>
    </div>

    <div v-if="filtersOpen" class="grid grid-cols-1 gap-2 rounded-lg border border-foreground/15 p-2 sm:grid-cols-3">
      <FormSelect id="filter-category" v-model="categoryId" label="Category" hide-label :options="categoryOptions" />
      <FormSelect id="filter-room" v-model="roomId" label="Room" hide-label :options="roomOptions" />
      <FormSelect id="filter-kind" v-model="kind" label="Type" hide-label :options="KIND_OPTIONS" />
      <div v-if="activeFacetCount(facets)" class="sm:col-span-3">
        <Button type="button" variant="link" size="sm" class="h-auto px-0" @click="clearFacets">
          Clear filters
        </Button>
      </div>
    </div>
  </div>
</template>
