import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { isRecurrenceUnit, localToday, nextDueDate } from '../../shared/recurrence'
import type { TaskRpcError } from '../../shared/validation/task'

export type CompleteTaskResult =
  | {
    ok: true
    completionId: string
    /** Recurring: the new due date. One-time: unchanged. */
    dueDate: string | null
    /** One-time: when it was completed. Recurring: null. */
    completedAt: string | null
    lastCompletedAt: string | null
  }
  | {
    ok: false
    status: 401 | 404 | 409 | 500
    code: TaskRpcError | 'unknown'
  }

const STATUS: Partial<Record<TaskRpcError, 401 | 404 | 409>> = {
  not_authenticated: 401,
  task_not_found: 404,
  already_completed: 409,
  stale_due_date: 409,
}

function failure(code: string | undefined): CompleteTaskResult {
  const known = code as TaskRpcError | undefined
  return {
    ok: false,
    status: (known && STATUS[known]) || 500,
    code: known ?? 'unknown',
  }
}

/**
 * Completes a task as the user behind `client` (RLS and the RPC's visibility check apply).
 * Recurring: next due = completion day in the household timezone + interval (D10, shared/recurrence.ts).
 * `expectedDueDate` is the due date the user saw; the RPC refuses if it changed (concurrent completion).
 * Used by POST /api/tasks/[id]/complete; kept free of Nuxt/h3 so tests can call it with any client.
 */
export async function completeTask(
  client: SupabaseClient<Database>,
  taskId: string,
  expectedDueDate: string | null | undefined,
  now: Date = new Date(),
): Promise<CompleteTaskResult> {
  const { data: task, error } = await client
    .from('tasks')
    .select('id, kind, due_date, recurrence_unit, recurrence_interval, households(timezone)')
    .eq('id', taskId)
    .maybeSingle()
  if (error) {
    return failure(undefined)
  }
  if (!task) {
    return failure('task_not_found')
  }

  let args: Database['public']['Functions']['complete_task']['Args'] = { p_task_id: task.id }
  if (task.kind === 'recurring') {
    if (!isRecurrenceUnit(task.recurrence_unit) || !task.recurrence_interval || !task.households) {
      return failure(undefined)
    }
    const today = localToday(task.households.timezone, now)
    args = {
      p_task_id: task.id,
      p_expected_due_date: expectedDueDate ?? task.due_date ?? undefined,
      p_next_due_date: nextDueDate(today, task.recurrence_unit, task.recurrence_interval),
    }
  }

  const { data, error: rpcError } = await client.rpc('complete_task', args).single()
  if (rpcError || !data) {
    return failure(rpcError?.message)
  }
  return {
    ok: true,
    completionId: data.completion_id,
    dueDate: data.due_date,
    completedAt: data.completed_at,
    lastCompletedAt: data.last_completed_at,
  }
}
