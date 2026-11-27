<script setup lang="ts">
import { CheckIcon, RepeatIcon } from '@lucide/vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import type { TaskListItem } from '~/composables/use-tasks'
import { describeRecurrence, dueLabel, type DueTone } from '#shared/task-list'

// Compact task row (features/TASKS.md §6): check circle, title, muted meta, due label.
const props = defineProps<{
  task: TaskListItem
  today: string
  /** Display name of the assignee, if any. */
  assigneeName?: string | null
}>()

const emit = defineEmits<{
  complete: []
  open: []
}>()

const due = computed(() => dueLabel(props.task.dueDate, props.today))
const recurrence = computed(() =>
  props.task.recurrenceUnit && props.task.recurrenceInterval
    ? describeRecurrence(props.task.recurrenceUnit, props.task.recurrenceInterval)
    : null,
)
const place = computed(() => [props.task.categoryName, props.task.roomName].filter(Boolean).join(' · '))
const meta = computed(() => [recurrence.value, place.value, props.assigneeName].filter(Boolean))

const TONE_CLASS: Record<DueTone, string> = {
  overdue: 'font-medium text-amber-700 dark:text-amber-400',
  today: 'font-medium text-foreground',
  soon: 'text-foreground',
  later: 'text-muted-foreground',
}

// Show the tick for a moment before the row moves or leaves (the list update itself is optimistic).
const ticking = ref(false)
const reduceMotion = usePreferredReducedMotion()

function onCheck() {
  if (ticking.value || props.task.pending) {
    return
  }
  ticking.value = true
  setTimeout(() => {
    emit('complete')
    ticking.value = false
  }, reduceMotion.value === 'reduce' ? 0 : 250)
}
</script>

<template>
  <li class="flex min-h-14 items-center gap-1 border-b last:border-b-0" :class="{ 'opacity-60': props.task.pending }">
    <button
      type="button"
      role="checkbox"
      :aria-checked="ticking"
      :aria-label="`Complete ${props.task.title}`"
      :disabled="props.task.pending"
      class="group -ml-2 grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      @click="onCheck"
    >
      <span
        class="grid size-5 place-items-center rounded-full border-2 border-muted-foreground/40 transition-colors group-hover:border-primary group-aria-checked:border-primary group-aria-checked:bg-primary"
      >
        <CheckIcon
          class="size-3 stroke-3 text-primary opacity-0 transition-opacity group-hover:opacity-40 group-aria-checked:text-primary-foreground group-aria-checked:opacity-100"
          aria-hidden="true"
        />
      </span>
    </button>

    <!-- The rest of the row opens the task (edit sheet). -->
    <button
      type="button"
      class="flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-md text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
      :disabled="props.task.pending"
      @click="emit('open')"
    >
      <span class="min-w-0 flex-1 py-2">
        <span class="block truncate text-start text-sm" dir="auto" :class="{ 'text-muted-foreground line-through': ticking }">
          {{ props.task.title }}
        </span>
        <span v-if="meta.length" class="block truncate text-start text-xs text-muted-foreground">
          <template v-for="(part, i) in meta" :key="i">
            <span v-if="i > 0" aria-hidden="true"> · </span>
            <span dir="auto">{{ part }}</span>
          </template>
        </span>
      </span>

      <span v-if="due" class="flex shrink-0 items-center gap-1 ps-2 text-xs" :class="TONE_CLASS[due.tone]" :title="due.description">
        <RepeatIcon v-if="props.task.kind === 'recurring'" class="size-3 opacity-70" aria-hidden="true" />
        <span aria-hidden="true">{{ due.text }}</span>
        <span class="sr-only">{{ due.description }}</span>
      </span>
    </button>
  </li>
</template>
