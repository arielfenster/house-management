import * as v from 'valibot'
import { isValidIsoDate } from '../recurrence'

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
