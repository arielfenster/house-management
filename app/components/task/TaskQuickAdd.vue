<script setup lang="ts">
import * as v from 'valibot'
import { TASK_TITLE_MAX_LENGTH, quickAddTaskSchema, type QuickAddTaskInput } from '#shared/validation/task'

// Quick add (features/TASKS.md §5): type a title, press Enter → a shared one-time task.
// The text is bound to the page so the header's "New task" button can carry it into the full form.
const props = defineProps<{
  add: (input: QuickAddTaskInput) => Promise<boolean>
}>()

const title = defineModel<string>({ required: true })

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
  <form novalidate @submit.prevent="submit">
    <label for="task-quick-add" class="sr-only">Quick add a task</label>
    <Input
      id="task-quick-add"
      :model-value="title"
      class="h-10"
      placeholder="Add a task and press Enter…"
      dir="auto"
      autocomplete="off"
      enterkeyhint="done"
      :maxlength="TASK_TITLE_MAX_LENGTH"
      @update:model-value="title = String($event)"
    />
  </form>
</template>
