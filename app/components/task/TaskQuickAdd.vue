<script setup lang="ts">
import * as v from 'valibot'
import { PlusIcon } from '@lucide/vue'
import { TASK_TITLE_MAX_LENGTH, quickAddTaskSchema, type QuickAddTaskInput } from '#shared/validation/task'

// Quick add (features/TASKS.md §5): type a title, press Enter → a shared one-time task. The full form comes in TASKS-007.
const props = defineProps<{
  add: (input: QuickAddTaskInput) => Promise<boolean>
}>()

const title = ref('')

async function submit() {
  const parsed = v.safeParse(quickAddTaskSchema, { title: title.value })
  if (!parsed.success) {
    return
  }
  // Clear at once so the next task can be typed; put the text back if saving failed.
  title.value = ''
  const ok = await props.add(parsed.output)
  if (!ok && !title.value) {
    title.value = parsed.output.title
  }
}
</script>

<template>
  <form class="flex items-center gap-2" novalidate @submit.prevent="submit">
    <label for="task-quick-add" class="sr-only">New task</label>
    <Input
      id="task-quick-add"
      v-model="title"
      class="h-10"
      placeholder="Add a task…"
      dir="auto"
      autocomplete="off"
      enterkeyhint="done"
      :maxlength="TASK_TITLE_MAX_LENGTH"
    />
    <Button type="submit" size="icon-lg" aria-label="Add task" :disabled="!title.trim()">
      <PlusIcon />
    </Button>
  </form>
</template>
