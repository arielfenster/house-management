<script setup lang="ts">
import { ListChecksIcon, SearchIcon, SlidersHorizontalIcon } from '@lucide/vue'
import type { TaskListItem } from '~/composables/use-tasks'
import { activeFacetCount, countByStatus, filterTasks, matchesFacets } from '#shared/task-filter'
import { doneLabel } from '#shared/task-list'

// Tasks: quick add, status tabs + search + filters (TASKS-009), open tasks sorted overdue → soonest → undated,
// one-tap completion with undo (TASKS-006), create/edit/delete sheet (TASKS-007/008). History: TASKS-010.
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
const { status, facets, searchOpen, filtersOpen, clearAll } = useTaskFilters()

const memberNames = computed(() => new Map(members.value.map(m => [m.id, m.displayName])))

const counts = computed(() => countByStatus(tasks.value, facets.value, today.value))
const facetCount = computed(() => activeFacetCount(facets.value))
const narrowed = computed(() => facetCount.value > 0 || facets.value.query.trim() !== '')

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

function openNew(title: string) {
  editing.value = null
  initialTitle.value = title
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
  <div>
    <PageHeader title="Tasks">
      <template #actions>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          title="Search"
          :aria-pressed="searchOpen"
          :class="{ 'bg-muted': searchOpen }"
          @click="searchOpen = !searchOpen"
        >
          <SearchIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="relative"
          :aria-label="facetCount ? `Filters (${facetCount} active)` : 'Filters'"
          title="Filters"
          :aria-pressed="filtersOpen"
          :class="{ 'bg-muted': filtersOpen }"
          @click="filtersOpen = !filtersOpen"
        >
          <SlidersHorizontalIcon />
          <span
            v-if="facetCount"
            class="absolute -end-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground"
            aria-hidden="true"
          >{{ facetCount }}</span>
        </Button>
      </template>
    </PageHeader>

    <TaskQuickAdd :add="quickAdd" class="mb-3" @more="openNew" />

    <TaskFilterBar :counts="counts" :categories="categories" :rooms="rooms" :members="members" class="mb-3" />

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
  </div>
</template>
