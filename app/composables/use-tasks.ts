import { useEventListener, useIntervalFn, useNow } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { API_ROUTES } from '#shared/routes'
import { isRecurrenceUnit, localToday, nextDueDate, type RecurrenceUnit } from '#shared/recurrence'
import { dueLabel, sortTasks } from '#shared/task-list'
import { taskErrorMessage, type QuickAddTaskInput } from '#shared/validation/task'

/** A row of the task list (open tasks only: completed one-time tasks are hidden from the default list). */
export interface TaskListItem {
  id: string
  title: string
  kind: 'one_time' | 'recurring'
  dueDate: string | null
  recurrenceUnit: RecurrenceUnit | null
  recurrenceInterval: number | null
  categoryName: string | null
  roomName: string | null
  lastCompletedAt: string | null
  createdAt: string
  /** Optimistic row not yet saved (quick add). */
  pending?: boolean
}

interface CompleteResponse {
  completionId: string
  dueDate: string | null
  completedAt: string | null
  lastCompletedAt: string | null
}

const UNDO_TOAST_MS = 8000

const TASK_COLUMNS = 'id, title, kind, due_date, recurrence_unit, recurrence_interval, last_completed_at, created_at, task_categories(name), rooms(name)'

/** Error code from a failed $fetch to our API (statusMessage carries the stable code, e.g. `stale_due_date`). */
function apiErrorCode(error: unknown): string | undefined {
  const e = error as { data?: { statusMessage?: string }, statusMessage?: string } | null
  return e?.data?.statusMessage ?? e?.statusMessage
}

/**
 * The household's open tasks, sorted (overdue → soonest → undated), with quick add and one-tap completion.
 * Reads and writes go straight to Supabase under RLS; completion goes through POST /api/tasks/:id/complete
 * (next due date in the household timezone). Updates are optimistic and rolled back on failure.
 */
export function useTasks() {
  const supabase = useSupabaseClient()
  const { membership } = useMembership()
  const { data: household } = useCurrentHousehold()
  const householdId = computed(() => membership.value?.householdId ?? null)
  const timezone = computed(() => household.value?.timezone ?? 'UTC')

  // "Today" in the household timezone; re-evaluated every minute so labels roll over at midnight.
  const now = useNow({ scheduler: tick => useIntervalFn(tick, 60_000) })
  const today = computed(() => localToday(timezone.value, now.value))

  const { data, pending, error, refresh } = useAsyncData(
    'tasks',
    async (): Promise<TaskListItem[]> => {
      if (!householdId.value) {
        return []
      }
      const { data: rows, error: queryError } = await supabase
        .from('tasks')
        .select(TASK_COLUMNS)
        .eq('household_id', householdId.value)
        .is('completed_at', null)
      if (queryError) {
        throw createError({ statusCode: 500, statusMessage: 'Could not load tasks.' })
      }
      return rows.map(row => ({
        id: row.id,
        title: row.title,
        kind: row.kind === 'recurring' ? 'recurring' : 'one_time',
        dueDate: row.due_date,
        recurrenceUnit: isRecurrenceUnit(row.recurrence_unit) ? row.recurrence_unit : null,
        recurrenceInterval: row.recurrence_interval,
        categoryName: row.task_categories?.name ?? null,
        roomName: row.rooms?.name ?? null,
        lastCompletedAt: row.last_completed_at,
        createdAt: row.created_at,
      }))
    },
    {
      watch: [householdId],
      default: () => [],
    },
  )

  const tasks = computed(() => sortTasks(data.value))

  // The other member may have changed things: refresh when the app comes back to the foreground.
  if (import.meta.client) {
    useEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    })
  }

  function replace(id: string, next: TaskListItem | null) {
    const rest = data.value.filter(t => t.id !== id)
    data.value = next ? [...rest, next] : rest
  }

  /** Quick add: a shared one-time task with just a title (features/TASKS.md §5). */
  async function quickAdd(input: QuickAddTaskInput): Promise<boolean> {
    if (!householdId.value) {
      return false
    }
    const tempId = `temp-${crypto.randomUUID()}`
    data.value = [...data.value, {
      id: tempId,
      title: input.title,
      kind: 'one_time',
      dueDate: null,
      recurrenceUnit: null,
      recurrenceInterval: null,
      categoryName: null,
      roomName: null,
      lastCompletedAt: null,
      createdAt: new Date().toISOString(),
      pending: true,
    }]
    const { data: row, error: insertError } = await supabase
      .from('tasks')
      .insert({ household_id: householdId.value, title: input.title, kind: 'one_time' })
      .select('id, created_at')
      .single()
    const optimistic = data.value.find(t => t.id === tempId)
    if (insertError || !row || !optimistic) {
      replace(tempId, null)
      toast.error('Could not add the task. Please try again.')
      return false
    }
    replace(tempId, {
      ...optimistic,
      id: row.id,
      createdAt: row.created_at,
      pending: false,
    })
    return true
  }

  /** Undo the completion just made (restores the row; recurring: previous due date). */
  async function undo(before: TaskListItem, completionId: string) {
    const { data: restored, error: undoError } = await supabase
      .rpc('uncomplete_task', { p_task_id: before.id, p_completion_id: completionId })
      .single()
    if (undoError || !restored) {
      toast.error(taskErrorMessage(undoError?.message))
      await refresh()
      return
    }
    replace(before.id, {
      ...before,
      dueDate: restored.due_date,
      lastCompletedAt: restored.last_completed_at,
    })
  }

  /** One tap: one-time tasks leave the list; recurring ones move to their next due date. Undo from the toast. */
  async function complete(task: TaskListItem) {
    if (task.pending) {
      return
    }
    const before = { ...task }
    // Optimistic: same rule as the server (completion day in the household timezone + interval).
    if (task.kind === 'recurring' && task.recurrenceUnit && task.recurrenceInterval) {
      replace(task.id, {
        ...task,
        dueDate: nextDueDate(today.value, task.recurrenceUnit, task.recurrenceInterval),
        lastCompletedAt: new Date().toISOString(),
      })
    } else {
      replace(task.id, null)
    }

    let result: CompleteResponse
    try {
      result = await $fetch<CompleteResponse>(API_ROUTES.completeTask(task.id), {
        method: 'POST',
        body: { expectedDueDate: task.dueDate },
      })
    } catch (err) {
      const code = apiErrorCode(err)
      replace(task.id, before)
      toast.error(taskErrorMessage(code))
      if (code === 'stale_due_date' || code === 'already_completed' || code === 'task_not_found') {
        await refresh()
      }
      return
    }

    let message = `Completed “${task.title}”`
    if (task.kind === 'recurring') {
      replace(task.id, {
        ...before,
        dueDate: result.dueDate,
        lastCompletedAt: result.lastCompletedAt,
      })
      const next = dueLabel(result.dueDate, today.value)
      message = next ? `“${task.title}” is next ${next.description.replace(/^Due /, 'due ')}` : message
    }
    toast.success(message, {
      // Long enough to notice a mis-tap and undo it.
      duration: UNDO_TOAST_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          void undo(before, result.completionId)
        },
      },
    })
  }

  return {
    tasks,
    today,
    pending,
    error,
    refresh,
    quickAdd,
    complete,
  }
}
