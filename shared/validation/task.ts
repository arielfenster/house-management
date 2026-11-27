import * as v from 'valibot'
import {
  RECURRENCE_INTERVAL_MAX,
  RECURRENCE_INTERVAL_MIN,
  RECURRENCE_UNITS,
  isValidIsoDate,
  type RecurrenceUnit,
} from '../recurrence'

// Keep in sync with the tasks table checks (supabase/migrations/*_tasks.sql).
export const TASK_TITLE_MAX_LENGTH = 200
export const TASK_DESCRIPTION_MAX_LENGTH = 2000

const isoDate = v.pipe(v.string(), v.check(isValidIsoDate, 'Invalid date.'))

/** Quick add: a title is all it takes. */
export const quickAddTaskSchema = v.object({
  title: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Enter a task.'),
    v.maxLength(TASK_TITLE_MAX_LENGTH, `Use at most ${TASK_TITLE_MAX_LENGTH} characters.`),
  ),
})

/**
 * Body of POST /api/tasks/[id]/complete. `expectedDueDate` is the due date the client showed (recurring tasks):
 * if someone completed or rescheduled the task meanwhile, the server answers 409 instead of completing twice.
 */
export const completeTaskBodySchema = v.object({
  expectedDueDate: v.optional(v.nullable(isoDate)),
})

/**
 * Task create/edit form (TASKS-007). Values are what the form holds (strings from inputs); the output is
 * normalized: trimmed text, `null` for empty optional fields, a number interval. Recurring tasks need an
 * interval, a unit and a next due date; one-time tasks have an optional due date.
 * Category and room are added with CreatableSelect in TASKS-008; visibility is always shared in v1 (D15).
 */
export const taskFormSchema = v.pipe(
  v.object({
    title: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty('Enter a title.'),
      v.maxLength(TASK_TITLE_MAX_LENGTH, `Use at most ${TASK_TITLE_MAX_LENGTH} characters.`),
    ),
    description: v.pipe(
      v.string(),
      v.trim(),
      v.maxLength(TASK_DESCRIPTION_MAX_LENGTH, `Use at most ${TASK_DESCRIPTION_MAX_LENGTH} characters.`),
      v.transform(text => text || null),
    ),
    kind: v.picklist(['one_time', 'recurring']),
    dueDate: v.pipe(
      v.string(),
      v.trim(),
      v.check(text => text === '' || isValidIsoDate(text), 'Enter a valid date.'),
      v.transform(text => text || null),
    ),
    recurrenceInterval: v.pipe(
      v.string(),
      v.trim(),
      v.transform(text => (text === '' ? Number.NaN : Number(text))),
    ),
    recurrenceUnit: v.picklist(RECURRENCE_UNITS),
    assignedTo: v.pipe(
      v.string(),
      v.transform(text => text || null),
      v.nullable(v.pipe(v.string(), v.uuid('Choose a member.'))),
    ),
  }),
  v.forward(
    v.check(
      input => input.kind === 'one_time'
        || (Number.isInteger(input.recurrenceInterval)
          && input.recurrenceInterval >= RECURRENCE_INTERVAL_MIN
          && input.recurrenceInterval <= RECURRENCE_INTERVAL_MAX),
      `Enter a whole number from ${RECURRENCE_INTERVAL_MIN} to ${RECURRENCE_INTERVAL_MAX}.`,
    ),
    ['recurrenceInterval'],
  ),
  v.forward(
    v.check(input => input.kind === 'one_time' || input.dueDate !== null, 'Choose when it is next due.'),
    ['dueDate'],
  ),
)

/** What the form fields hold (all strings, like the inputs). */
export interface TaskFormValues {
  title: string
  description: string
  kind: 'one_time' | 'recurring'
  dueDate: string
  recurrenceInterval: string
  recurrenceUnit: RecurrenceUnit
  assignedTo: string
}

export type TaskFormOutput = v.InferOutput<typeof taskFormSchema>

/** Columns written by the form (insert and update). Recurrence columns are cleared for one-time tasks. */
export interface TaskFormColumns {
  title: string
  description: string | null
  kind: 'one_time' | 'recurring'
  due_date: string | null
  recurrence_unit: RecurrenceUnit | null
  recurrence_interval: number | null
  assigned_to: string | null
}

export function taskFormToColumns(form: TaskFormOutput): TaskFormColumns {
  const recurring = form.kind === 'recurring'
  return {
    title: form.title,
    description: form.description,
    kind: form.kind,
    due_date: form.dueDate,
    recurrence_unit: recurring ? form.recurrenceUnit : null,
    recurrence_interval: recurring ? form.recurrenceInterval : null,
    assigned_to: form.assignedTo,
  }
}

export const taskIdSchema = v.pipe(v.string(), v.uuid('Invalid task id.'))

export type QuickAddTaskInput = v.InferOutput<typeof quickAddTaskSchema>
export type CompleteTaskBody = v.InferOutput<typeof completeTaskBodySchema>

/** Errors raised by complete_task / uncomplete_task (stable messages, see the migration). */
export type TaskRpcError =
  | 'not_authenticated'
  | 'task_not_found'
  | 'already_completed'
  | 'stale_due_date'
  | 'invalid_next_due_date'
  | 'no_completion'
  | 'not_completed'
  | 'not_latest_completion'

/** Maps a completion error code to user-facing text. */
export function taskErrorMessage(code: string | undefined): string {
  switch (code as TaskRpcError | undefined) {
    case 'not_authenticated':
      return 'Your session expired. Log in again.'
    case 'task_not_found':
      return 'This task no longer exists.'
    case 'already_completed':
    case 'stale_due_date':
      return 'Someone else just updated this task. The list was refreshed.'
    case 'no_completion':
    case 'not_completed':
    case 'not_latest_completion':
      return 'This can no longer be undone.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
