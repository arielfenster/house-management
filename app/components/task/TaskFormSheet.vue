<script setup lang="ts">
import * as v from 'valibot'
import { Trash2Icon } from '@lucide/vue'
import type { HouseholdMember } from '~/composables/use-household-members'
import type { TaskListItem } from '~/composables/use-tasks'
import { RECURRENCE_INTERVAL_MAX, RECURRENCE_INTERVAL_MIN, RECURRENCE_UNITS, addDays, type RecurrenceUnit } from '#shared/recurrence'
import { fieldErrors } from '#shared/validation/auth'
import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  taskFormSchema,
  taskFormToColumns,
  type TaskFormColumns,
  type TaskFormValues,
} from '#shared/validation/task'

// Task create/edit form (TASKS-007) in a bottom sheet (phone) / dialog (desktop). Category and room: TASKS-008.
const props = defineProps<{
  /** The task being edited; null creates a new one. */
  task: TaskListItem | null
  /** Pre-filled title when opened from quick add ("More options"). */
  initialTitle?: string
  members: HouseholdMember[]
  /** Today in the household timezone (`YYYY-MM-DD`). */
  today: string
  /** Saves; resolves to an error message, or null on success. */
  save: (id: string | null, columns: TaskFormColumns) => Promise<string | null>
}>()

const emit = defineEmits<{
  delete: [task: TaskListItem]
}>()

const open = defineModel<boolean>('open', { required: true })

function initialValues(): TaskFormValues {
  const task = props.task
  return {
    title: task?.title ?? props.initialTitle ?? '',
    description: task?.description ?? '',
    kind: task?.kind ?? 'one_time',
    dueDate: task?.dueDate ?? '',
    recurrenceInterval: String(task?.recurrenceInterval ?? 1),
    recurrenceUnit: task?.recurrenceUnit ?? 'week',
    assignedTo: task?.assignedTo ?? '',
  }
}

const form = reactive<TaskFormValues>(initialValues())
const errors = ref<Record<string, string>>({})
const formError = ref('')
const saving = ref(false)

// Fresh values every time the sheet opens (new task, or another task to edit).
watch(open, (isOpen) => {
  if (isOpen) {
    Object.assign(form, initialValues())
    errors.value = {}
    formError.value = ''
  }
})

const isEdit = computed(() => props.task !== null)
const recurring = computed(() => form.kind === 'recurring')

function setKind(kind: TaskFormValues['kind']) {
  form.kind = kind
  // A repeating task always has a next due date; start from today.
  if (kind === 'recurring' && !form.dueDate) {
    form.dueDate = props.today
  }
  errors.value = {}
}

const UNIT_LABELS: Record<RecurrenceUnit, [string, string]> = {
  day: ['day', 'days'],
  week: ['week', 'weeks'],
  month: ['month', 'months'],
  year: ['year', 'years'],
}
const unitOptions = computed(() => {
  const plural = Number(form.recurrenceInterval) !== 1
  return RECURRENCE_UNITS.map(unit => ({
    value: unit,
    label: UNIT_LABELS[unit][plural ? 1 : 0],
  }))
})

const assigneeOptions = computed(() => [
  {
    value: '',
    label: 'Anyone',
  },
  ...props.members.map(m => ({
    value: m.id,
    label: m.displayName,
  })),
])

// One-tap dates (speed first): relative to today in the household timezone.
const quickDates = computed(() => [
  {
    label: 'Today',
    value: props.today,
  },
  {
    label: 'Tomorrow',
    value: addDays(props.today, 1),
  },
  {
    label: 'In a week',
    value: addDays(props.today, 7),
  },
])

async function submit() {
  formError.value = ''
  const parsed = v.safeParse(taskFormSchema, form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.issues)
    return
  }
  errors.value = {}
  saving.value = true
  const message = await props.save(props.task?.id ?? null, taskFormToColumns(parsed.output))
  saving.value = false
  if (message) {
    formError.value = message
    return
  }
  open.value = false
}

function remove() {
  if (props.task) {
    open.value = false
    emit('delete', props.task)
  }
}
</script>

<template>
  <ResponsiveSheet v-model:open="open" :title="isEdit ? 'Edit task' : 'New task'" :prevent-auto-focus="isEdit">
    <form class="space-y-4 pb-1" novalidate @submit.prevent="submit">
      <FormField
        id="task-title"
        v-model="form.title"
        label="Title"
        placeholder="e.g. Clean AC filters"
        :maxlength="TASK_TITLE_MAX_LENGTH"
        :autofocus="!isEdit"
        :error="errors.title"
      />

      <div class="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Task type">
        <Button type="button" :variant="recurring ? 'ghost' : 'outline'" size="sm" :aria-pressed="!recurring" @click="setKind('one_time')">
          One-time
        </Button>
        <Button type="button" :variant="recurring ? 'outline' : 'ghost'" size="sm" :aria-pressed="recurring" @click="setKind('recurring')">
          Repeats
        </Button>
      </div>

      <fieldset v-if="recurring" class="space-y-1.5">
        <legend class="mb-1.5 text-sm font-medium">
          Repeat every
        </legend>
        <div class="flex gap-2">
          <label for="task-interval" class="sr-only">Interval</label>
          <Input
            id="task-interval"
            :model-value="form.recurrenceInterval"
            class="w-20"
            type="number"
            inputmode="numeric"
            dir="ltr"
            :min="RECURRENCE_INTERVAL_MIN"
            :max="RECURRENCE_INTERVAL_MAX"
            :aria-invalid="errors.recurrenceInterval ? true : undefined"
            :aria-describedby="errors.recurrenceInterval ? 'task-interval-error' : undefined"
            @update:model-value="form.recurrenceInterval = String($event)"
          />
          <FormSelect id="task-unit" v-model="form.recurrenceUnit" class="flex-1" label="Unit" hide-label :options="unitOptions" />
        </div>
        <p v-if="errors.recurrenceInterval" id="task-interval-error" class="text-xs text-destructive">
          {{ errors.recurrenceInterval }}
        </p>
        <p class="text-xs text-muted-foreground">
          The next due date is counted from the day it is done.
        </p>
      </fieldset>

      <div class="space-y-1.5">
        <FormField
          id="task-due"
          v-model="form.dueDate"
          :label="recurring ? 'Next due' : 'Due date (optional)'"
          type="date"
          dir="ltr"
          :error="errors.dueDate"
        />
        <div class="flex flex-wrap gap-1.5">
          <Button
            v-for="quick in quickDates"
            :key="quick.label"
            type="button"
            size="xs"
            :variant="form.dueDate === quick.value ? 'secondary' : 'outline'"
            @click="form.dueDate = quick.value"
          >
            {{ quick.label }}
          </Button>
          <Button v-if="!recurring && form.dueDate" type="button" size="xs" variant="ghost" @click="form.dueDate = ''">
            No date
          </Button>
        </div>
      </div>

      <FormSelect id="task-assignee" v-model="form.assignedTo" label="Assigned to" :options="assigneeOptions" :error="errors.assignedTo" />

      <FormTextarea
        id="task-description"
        v-model="form.description"
        label="Notes (optional)"
        :maxlength="TASK_DESCRIPTION_MAX_LENGTH"
        :rows="2"
        :error="errors.description"
      />

      <p v-if="formError" role="alert" class="text-sm text-destructive">
        {{ formError }}
      </p>

      <div class="flex items-center gap-2 pt-1">
        <Button v-if="isEdit" type="button" variant="ghost" class="text-destructive hover:text-destructive" @click="remove">
          <Trash2Icon />
          Delete
        </Button>
        <Button type="submit" class="flex-1" :disabled="saving">
          {{ saving ? 'Saving…' : isEdit ? 'Save' : 'Add task' }}
        </Button>
      </div>
    </form>
  </ResponsiveSheet>
</template>
