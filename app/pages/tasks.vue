<script setup lang="ts">
import { ListChecksIcon } from '@lucide/vue'
import type { TaskListItem } from '~/composables/use-tasks'

// Task list: quick add, open tasks sorted overdue → soonest → undated, one-tap completion with undo (TASKS-006),
// create/edit/delete sheet (TASKS-007). Filters, search and history follow in TASKS-008…010.
const { tasks, today, pending, error, refresh, quickAdd, complete, saveTask, deleteTask } = useTasks()
const { data: members } = useHouseholdMembers()

const memberNames = computed(() => new Map(members.value.map(m => [m.id, m.displayName])))

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
</script>

<template>
  <div>
    <PageHeader title="Tasks" />

    <TaskQuickAdd :add="quickAdd" class="mb-3" @more="openNew" />

    <div v-if="pending && !tasks.length" class="rounded-lg border border-foreground/20 bg-card shadow-xs" aria-busy="true" aria-label="Loading tasks">
      <div v-for="i in 5" :key="i" class="flex h-14 items-center gap-3 border-b border-foreground/10 px-4 last:border-b-0">
        <div class="size-5 rounded-full bg-muted" />
        <div class="h-3 flex-1 rounded bg-muted" :style="{ maxWidth: `${40 + ((i * 17) % 45)}%` }" />
        <div class="h-3 w-12 rounded bg-muted" />
      </div>
    </div>

    <div v-else-if="error" class="py-12 text-center text-sm text-muted-foreground" role="alert">
      Could not load your tasks.
      <Button variant="link" size="sm" @click="refresh()">
        Try again
      </Button>
    </div>

    <EmptyState
      v-else-if="!tasks.length"
      title="No tasks yet"
      description="Type one above and press Enter — for example “Water plants”."
    >
      <ListChecksIcon />
    </EmptyState>

    <!-- One bordered box with dividers between rows (docs/05: separators, not cards). -->
    <ul v-else aria-label="Tasks" class="overflow-hidden rounded-lg border border-foreground/20 bg-card shadow-xs">
      <TaskRow
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :today="today"
        :assignee-name="task.assignedTo ? memberNames.get(task.assignedTo) : null"
        @complete="complete(task)"
        @open="openTask(task)"
      />
    </ul>

    <TaskFormSheet
      v-model:open="sheetOpen"
      :task="editing"
      :initial-title="initialTitle"
      :members="members"
      :today="today"
      :save="saveTask"
      @delete="deleteTask"
      @lists-changed="refresh()"
    />
  </div>
</template>
