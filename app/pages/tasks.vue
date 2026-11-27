<script setup lang="ts">
import { ListChecksIcon } from '@lucide/vue'

// Task list (TASKS-006): quick add, open tasks sorted overdue → soonest → undated, one-tap completion with undo.
// Detail/edit sheet, filters and search follow in TASKS-007…010.
const { tasks, today, pending, error, refresh, quickAdd, complete } = useTasks()
</script>

<template>
  <div>
    <PageHeader title="Tasks" />

    <TaskQuickAdd :add="quickAdd" class="mb-1" />

    <div v-if="pending && !tasks.length" class="pt-1" aria-busy="true" aria-label="Loading tasks">
      <div v-for="i in 5" :key="i" class="flex h-14 items-center gap-3 border-b last:border-b-0">
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

    <ul v-else aria-label="Tasks">
      <TaskRow v-for="task in tasks" :key="task.id" :task="task" :today="today" @complete="complete(task)" />
    </ul>
  </div>
</template>
