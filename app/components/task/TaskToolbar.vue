<script setup lang="ts">
import { SearchIcon, SlidersHorizontalIcon, XIcon } from '@lucide/vue'
import { useEventListener } from '@vueuse/core'
import type { ActiveFilter } from '~/composables/use-task-filter-sections'
import type { OpenTaskStatusFilter, TaskStatusFilter } from '#shared/task-filter'

// Above the task list: search box + Filters button, active filters as removable chips, status tabs (TASKS-009).
const props = defineProps<{
  /** Open-task counts per status (with filters and search applied). */
  counts: Record<OpenTaskStatusFilter, number>
  activeFilters: ActiveFilter[]
}>()

const emit = defineEmits<{
  removeFilter: [key: ActiveFilter['key']]
  clearFilters: []
}>()

const { status, facets, filtersOpen, setFacet } = useTaskFilters()

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

const query = computed({
  get: () => facets.value.query,
  set: (value: string) => setFacet('query', value),
})

const searchBox = useTemplateRef<HTMLElement>('searchBox')

// Desktop: "/" or Ctrl/Cmd+K focuses search (docs/05), unless already typing somewhere.
if (import.meta.client) {
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    const typing = target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')
    if ((event.key === '/' && !typing) || (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey))) {
      event.preventDefault()
      searchBox.value?.querySelector('input')?.focus()
    }
  })
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <div ref="searchBox" class="relative min-w-0 flex-1">
        <SearchIcon class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          :model-value="query"
          type="search"
          aria-label="Search tasks"
          placeholder="Search tasks"
          dir="auto"
          autocomplete="off"
          enterkeyhint="search"
          class="h-10 ps-9 pe-9 [&::-webkit-search-cancel-button]:hidden"
          @update:model-value="query = String($event)"
          @keydown.esc="query = ''"
        />
        <Button
          v-if="query"
          type="button"
          variant="ghost"
          size="icon-sm"
          class="absolute end-1 top-1/2 -translate-y-1/2"
          aria-label="Clear search"
          @click="query = ''"
        >
          <XIcon />
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        class="h-10 shrink-0 gap-2"
        :aria-label="props.activeFilters.length ? `Filters (${props.activeFilters.length} active)` : 'Filters'"
        @click="filtersOpen = true"
      >
        <SlidersHorizontalIcon />
        Filters
        <span
          v-if="props.activeFilters.length"
          class="grid size-5 place-items-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
          aria-hidden="true"
        >{{ props.activeFilters.length }}</span>
      </Button>
    </div>

    <!-- Active filters: tap a chip to remove it. -->
    <div v-if="props.activeFilters.length" class="flex flex-wrap items-center gap-2">
      <button
        v-for="filter in props.activeFilters"
        :key="filter.key"
        type="button"
        class="inline-flex h-8 items-center gap-1.5 rounded-full border border-foreground/20 bg-muted ps-2.5 pe-2 text-sm transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
        :aria-label="`Remove filter ${filter.sectionLabel}: ${filter.label}`"
        @click="emit('removeFilter', filter.key)"
      >
        <component :is="filter.icon" class="size-3.5 text-muted-foreground" aria-hidden="true" />
        <span dir="auto">{{ filter.label }}</span>
        <XIcon class="size-3.5 text-muted-foreground" aria-hidden="true" />
      </button>
      <Button type="button" variant="ghost" size="sm" class="h-8 text-muted-foreground" @click="emit('clearFilters')">
        Clear all
      </Button>
    </div>

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
  </div>
</template>
