<script setup lang="ts">
import type { Component } from 'vue'
import { CheckIcon, DoorOpenIcon, RepeatIcon, TagIcon, UserRoundIcon } from '@lucide/vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import type { TaskListItem } from '~/composables/use-tasks'
import { describeRecurrence, dueLabel, type DueTone } from '#shared/task-list'

// Compact task row (features/TASKS.md §6): check circle, title, meta (icon + text each), due label.
const props = defineProps<{
  task: TaskListItem
  today: string
  /** Display name of the assignee, if any. */
  assigneeName?: string | null
  /** Completed tasks (Done tab): "Done Nov 27", shown instead of the due label. */
  doneText?: string | null
}>()

const emit = defineEmits<{
  complete: []
  /** Un-ticked a completed task. */
  reopen: []
  open: []
}>()

const done = computed(() => props.task.completedAt !== null)

const due = computed(() => (done.value ? null : dueLabel(props.task.dueDate, props.today)))
const recurrence = computed(() =>
  props.task.recurrenceUnit && props.task.recurrenceInterval
    ? describeRecurrence(props.task.recurrenceUnit, props.task.recurrenceInterval)
    : null,
)
interface MetaItem {
  key: string
  icon: Component
  /** Read before the value by screen readers ("Category: Maintenance"). */
  label: string
  text: string
}

// Recurrence, assignee, category, room — each with its own icon so they read apart at a glance.
const meta = computed(() => {
  const items: (MetaItem | null)[] = [
    recurrence.value ? { key: 'recurrence', icon: RepeatIcon, label: 'Repeats', text: recurrence.value } : null,
    props.assigneeName ? { key: 'assignee', icon: UserRoundIcon, label: 'Assigned to', text: props.assigneeName } : null,
    props.task.categoryName ? { key: 'category', icon: TagIcon, label: 'Category', text: props.task.categoryName } : null,
    props.task.roomName ? { key: 'room', icon: DoorOpenIcon, label: 'Room', text: props.task.roomName } : null,
  ]
  return items.filter(item => item !== null)
})

const TONE_CLASS: Record<DueTone, string> = {
  overdue: 'font-medium text-amber-700 dark:text-amber-400',
  today: 'font-medium text-foreground',
  soon: 'text-foreground',
  later: 'text-muted-foreground',
}

// Show the tick (or un-tick) for a moment before the row moves or leaves (the list update itself is optimistic).
const ticking = ref(false)
const checked = computed(() => (done.value ? !ticking.value : ticking.value))
const reduceMotion = usePreferredReducedMotion()

function onCheck() {
  if (ticking.value || props.task.pending) {
    return
  }
  ticking.value = true
  setTimeout(() => {
    if (done.value) {
      emit('reopen')
    } else {
      emit('complete')
    }
    ticking.value = false
  }, reduceMotion.value === 'reduce' ? 0 : 250)
}
</script>

<template>
  <!-- `hover:` only applies on devices that can hover (Tailwind v4), so phones get no sticky highlight. -->
  <li
    class="flex min-h-14 items-center gap-1 border-b border-foreground/10 ps-1 pe-3 transition-colors last:border-b-0 hover:bg-muted"
    :class="{ 'opacity-60': props.task.pending }"
  >
    <button
      type="button"
      role="checkbox"
      :aria-checked="checked"
      :aria-label="done ? `Reopen ${props.task.title}` : `Complete ${props.task.title}`"
      :disabled="props.task.pending"
      class="group grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
        <span class="block truncate text-start text-sm" dir="auto" :class="{ 'text-muted-foreground line-through': checked }">
          {{ props.task.title }}
        </span>
        <!-- Wraps to a second line on narrow screens rather than cutting values off. -->
        <span v-if="meta.length" class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span v-for="item in meta" :key="item.key" class="inline-flex min-w-0 max-w-full items-center gap-1" :title="item.label">
            <component :is="item.icon" class="size-3.5 shrink-0" aria-hidden="true" />
            <span class="sr-only">{{ item.label }}:</span>
            <span class="truncate" dir="auto">{{ item.text }}</span>
          </span>
        </span>
      </span>

      <span v-if="props.doneText" class="shrink-0 ps-2 text-xs text-muted-foreground">{{ props.doneText }}</span>
      <span v-if="due" class="shrink-0 ps-2 text-xs" :class="TONE_CLASS[due.tone]" :title="due.description">
        <span aria-hidden="true">{{ due.text }}</span>
        <span class="sr-only">{{ due.description }}</span>
      </span>
    </button>
  </li>
</template>
