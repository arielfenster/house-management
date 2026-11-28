<script setup lang="ts">
import { ListChecksIcon, PlusIcon } from '@lucide/vue'
import type { TaskListItem } from '~/composables/use-tasks'
import { countByStatus, filterTasks, matchesFacets } from '#shared/task-filter'
import { doneLabel } from '#shared/task-list'

// Tasks: "New task" (full form; header on desktop, floating button on phones), quick add, search + Filters sheet + status tabs (TASKS-009),
// open tasks sorted overdue → soonest → undated, one-tap completion with undo (TASKS-006),
// create/edit/delete sheet (TASKS-007/008) with history (TASKS-010).
const {
  tasks,
  today,
  timezone,
  pending,
  error,
  refresh,
  quickAdd,
  complete,
  saveTask,
  deleteTask,
  completedTasks,
  completedLoaded,
  completedPending,
  loadCompleted,
  reopen,
} = useTasks()
const { data: members } = useHouseholdMembers()
const { values: categories } = useTaskList('task_categories')
const { values: rooms } = useTaskList('rooms')
const { status, facets, filtersOpen, clearFacets, clearAll } = useTaskFilters()
const { sections: filterSections, activeFilters, setFilter } = useTaskFilterSections(rooms, categories, members)

/** Quick add text; "New task" carries it into the full form. */
const quickTitle = ref('')

const memberNames = computed(() => new Map(members.value.map(m => [m.id, m.displayName])))

const counts = computed(() => countByStatus(tasks.value, facets.value, today.value))
const narrowed = computed(() => activeFilters.value.length > 0 || facets.value.query.trim() !== '')

const showingCompleted = computed(() => status.value === 'completed')
const visibleTasks = computed(() => {
  if (status.value === 'completed') {
    return completedTasks.value.filter(task => matchesFacets(task, facets.value))
  }
  return filterTasks(tasks.value, status.value, facets.value, today.value)
})

// The Done tab loads completed tasks the first time it is shown.
watch(status, (value) => {
  if (value === 'completed' && !completedLoaded.value) {
    void loadCompleted()
  }
}, { immediate: true })

const loading = computed(() => (showingCompleted.value ? completedPending.value && !completedLoaded.value : pending.value && !tasks.value.length))

const emptyMessage = computed(() => {
  if (narrowed.value) {
    return {
      title: 'No matching tasks',
      description: 'Try other words or clear the filters.',
    }
  }
  switch (status.value) {
    case 'upcoming':
      return {
        title: 'Nothing coming up',
        description: 'Tasks with a due date of today or later show here.',
      }
    case 'overdue':
      return {
        title: 'Nothing overdue',
        description: 'You are all caught up.',
      }
    case 'completed':
      return {
        title: 'No completed tasks yet',
        description: 'One-time tasks you tick off show here. Repeating tasks move to their next date instead.',
      }
    default:
      return {
        title: 'No tasks yet',
        description: 'Type one above and press Enter — for example “Water plants”.',
      }
  }
})

const sheetOpen = ref(false)
const editing = ref<TaskListItem | null>(null)
const initialTitle = ref('')

function openNew() {
  editing.value = null
  initialTitle.value = quickTitle.value.trim()
  quickTitle.value = ''
  sheetOpen.value = true
}

function openTask(task: TaskListItem) {
  editing.value = task
  initialTitle.value = ''
  sheetOpen.value = true
}

async function onListsChanged() {
  await refresh()
  if (completedLoaded.value) {
    await loadCompleted()
  }
}
</script>

<template>
  <div class="pb-20 md:pb-0">
    <!-- pb-20 (phones): room under the list for the floating "New task" button. -->
    <PageHeader title="Tasks">
      <template #actions>
        <!-- Desktop: in the header. Phones use the floating button below (thumb reach, away from the account icon). -->
        <Button size="sm" class="hidden md:inline-flex" @click="openNew">
          <PlusIcon />
          New task
        </Button>
      </template>
    </PageHeader>

    <TaskQuickAdd v-model="quickTitle" :add="quickAdd" class="mb-3" />

    <TaskToolbar
      :counts="counts"
      :active-filters="activeFilters"
      class="mb-3"
      @remove-filter="setFilter($event, null)"
      @clear-filters="clearFacets"
    />

    <div v-if="loading" class="rounded-lg border border-foreground/20 bg-card shadow-xs" aria-busy="true" aria-label="Loading tasks">
      <div v-for="i in 5" :key="i" class="flex h-14 items-center gap-3 border-b border-foreground/10 px-4 last:border-b-0">
        <div class="size-5 rounded-full bg-muted" />
        <div class="h-3 flex-1 rounded bg-muted" :style="{ maxWidth: `${40 + ((i * 17) % 45)}%` }" />
        <div class="h-3 w-12 rounded bg-muted" />
      </div>
    </div>

    <div v-else-if="error && !showingCompleted" class="py-12 text-center text-sm text-muted-foreground" role="alert">
      Could not load your tasks.
      <Button variant="link" size="sm" @click="refresh()">
        Try again
      </Button>
    </div>

    <EmptyState v-else-if="!visibleTasks.length" :title="emptyMessage.title" :description="emptyMessage.description">
      <ListChecksIcon />
      <template v-if="narrowed" #action>
        <Button variant="outline" size="sm" @click="clearAll">
          Clear search and filters
        </Button>
      </template>
    </EmptyState>

    <!-- One bordered box with dividers between rows (docs/05: separators, not cards). -->
    <ul v-else :aria-label="showingCompleted ? 'Completed tasks' : 'Tasks'" class="overflow-hidden rounded-lg border border-foreground/20 bg-card shadow-xs">
      <TaskRow
        v-for="task in visibleTasks"
        :key="task.id"
        :task="task"
        :today="today"
        :assignee-name="task.assignedTo ? memberNames.get(task.assignedTo) : null"
        :done-text="task.completedAt ? doneLabel(task.completedAt, timezone, today) : null"
        @complete="complete(task)"
        @reopen="reopen(task)"
        @open="openTask(task)"
      />
    </ul>

    <TaskFormSheet
      v-model:open="sheetOpen"
      :task="editing"
      :initial-title="initialTitle"
      :members="members"
      :today="today"
      :timezone="timezone"
      :save="saveTask"
      @delete="deleteTask"
      @lists-changed="onListsChanged"
    />

    <!-- Phones: floating "New task" button, bottom right just above the nav bar. -->
    <Button
      class="fixed end-4 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] z-30 h-14 gap-2 rounded-full px-5 text-base shadow-lg md:hidden"
      @click="openNew"
    >
      <PlusIcon class="size-5" />
      New task
    </Button>

    <TaskFiltersSheet
      v-model:open="filtersOpen"
      :sections="filterSections"
      :result-count="visibleTasks.length"
      @set="setFilter"
      @clear="clearFacets"
    />
  </div>
</template>
