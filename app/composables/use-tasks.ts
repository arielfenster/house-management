import { useEventListener, useIntervalFn, useNow } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { API_ROUTES } from '#shared/routes'
import { isRecurrenceUnit, localToday, nextDueDate, type RecurrenceUnit } from '#shared/recurrence'
import { dueLabel, sortTasks } from '#shared/task-list'
import { taskErrorMessage, type QuickAddTaskInput, type TaskFormColumns } from '#shared/validation/task'

/** A row of the task list. Open tasks, or (Done tab) completed one-time tasks with `completedAt` set. */
export interface TaskListItem {
  id: string
  title: string
  description: string | null
  kind: 'one_time' | 'recurring'
  dueDate: string | null
  recurrenceUnit: RecurrenceUnit | null
  recurrenceInterval: number | null
  categoryId: string | null
  categoryName: string | null
  roomId: string | null
  roomName: string | null
  assignedTo: string | null
  lastCompletedAt: string | null
  /** One-time tasks only: when it was completed (null = open). */
  completedAt: string | null
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

const TASK_COLUMNS = 'id, title, description, kind, due_date, recurrence_unit, recurrence_interval, assigned_to, category_id, room_id, last_completed_at, completed_at, created_at, task_categories(name), rooms(name)'

interface TaskRow {
  id: string
  title: string
  description: string | null
  kind: string
  due_date: string | null
  recurrence_unit: string | null
  recurrence_interval: number | null
  assigned_to: string | null
  category_id: string | null
  room_id: string | null
  last_completed_at: string | null
  completed_at: string | null
  created_at: string
  task_categories: { name: string } | null
  rooms: { name: string } | null
}

function toItem(row: TaskRow): TaskListItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind === 'recurring' ? 'recurring' : 'one_time',
    dueDate: row.due_date,
    recurrenceUnit: isRecurrenceUnit(row.recurrence_unit) ? row.recurrence_unit : null,
    recurrenceInterval: row.recurrence_interval,
    categoryId: row.category_id,
    categoryName: row.task_categories?.name ?? null,
    roomId: row.room_id,
    roomName: row.rooms?.name ?? null,
    assignedTo: row.assigned_to,
    lastCompletedAt: row.last_completed_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }
}

/** Most recent completed one-time tasks loaded for the Done tab. */
const COMPLETED_LIMIT = 200

/** Error code from a failed $fetch to our API (statusMessage carries the stable code, e.g. `stale_due_date`). */
function apiErrorCode(error: unknown): string | undefined {
  const e = error as { data?: { statusMessage?: string }, statusMessage?: string } | null
  return e?.data?.statusMessage ?? e?.statusMessage
}

/**
 * The household's open tasks, sorted (overdue → soonest → undated), with quick add and one-tap completion,
 * plus the completed one-time tasks for the Done tab (loaded on demand, newest first).
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
      return rows.map(toItem)
    },
    {
      watch: [householdId],
      default: () => [],
    },
  )

  // Deletes wait for the undo window (see deleteTask); their rows stay hidden meanwhile, even across refreshes.
  const pendingDeletes = new Map<string, ReturnType<typeof setTimeout>>()
  const hiddenIds = ref(new Set<string>())

  // Quick-add rows waiting for the insert. Kept apart from `data` so a list fetch that lands meanwhile
  // (e.g. the first load right after navigating here) cannot wipe them.
  const pendingAdds = ref<TaskListItem[]>([])

  const tasks = computed(() => sortTasks([
    ...data.value.filter(t => !hiddenIds.value.has(t.id)),
    ...pendingAdds.value,
  ]))

  // Done tab: completed one-time tasks, fetched when first shown (TASKS-009).
  const completed = ref<TaskListItem[]>([])
  const completedLoaded = ref(false)
  const completedPending = ref(false)
  const completedTasks = computed(() =>
    completed.value
      .filter(t => !hiddenIds.value.has(t.id))
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
  )

  async function loadCompleted() {
    if (!householdId.value) {
      return
    }
    completedPending.value = true
    const { data: rows, error: queryError } = await supabase
      .from('tasks')
      .select(TASK_COLUMNS)
      .eq('household_id', householdId.value)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(COMPLETED_LIMIT)
    completedPending.value = false
    if (queryError) {
      toast.error('Could not load completed tasks.')
      return
    }
    completed.value = rows.map(toItem)
    completedLoaded.value = true
  }

  function replaceCompleted(id: string, next: TaskListItem | null) {
    const rest = completed.value.filter(t => t.id !== id)
    completed.value = next ? [...rest, next] : rest
  }

  if (import.meta.client) {
    useEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // The other member may have changed things: refresh when the app comes back to the foreground.
        void refresh()
        if (completedLoaded.value) {
          void loadCompleted()
        }
      } else {
        // Leaving the app ends the undo window: delete now rather than risk the request never being sent.
        flushDeletes()
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
    pendingAdds.value = [...pendingAdds.value, {
      id: tempId,
      title: input.title,
      description: null,
      kind: 'one_time',
      dueDate: null,
      recurrenceUnit: null,
      recurrenceInterval: null,
      categoryId: null,
      categoryName: null,
      roomId: null,
      roomName: null,
      assignedTo: null,
      lastCompletedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      pending: true,
    }]
    const { data: row, error: insertError } = await supabase
      .from('tasks')
      .insert({ household_id: householdId.value, title: input.title, kind: 'one_time' })
      .select(TASK_COLUMNS)
      .single()
    pendingAdds.value = pendingAdds.value.filter(t => t.id !== tempId)
    if (insertError || !row) {
      toast.error('Could not add the task. Please try again.')
      return false
    }
    // Saved: show the real row (whatever happened to the list meanwhile).
    replace(row.id, toItem(row))
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
    replaceCompleted(before.id, null)
    replace(before.id, {
      ...before,
      dueDate: restored.due_date,
      lastCompletedAt: restored.last_completed_at,
      completedAt: null,
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
    if (task.kind === 'one_time' && completedLoaded.value) {
      replaceCompleted(task.id, {
        ...before,
        completedAt: result.completedAt,
      })
    }
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

  /** Create (no id) or update a task from the form (TASKS-007). New tasks are shared (D15). */
  async function saveTask(id: string | null, columns: TaskFormColumns): Promise<string | null> {
    if (!householdId.value) {
      return null
    }
    const query = id
      ? supabase.from('tasks').update(columns).eq('id', id)
      : supabase.from('tasks').insert({ ...columns, household_id: householdId.value })
    const { data: row, error: saveError } = await query.select(TASK_COLUMNS).single()
    if (saveError || !row) {
      return saveError?.message === 'assignee_not_member'
        ? 'That person is no longer in the household.'
        : 'Could not save the task. Please try again.'
    }
    const item = toItem(row)
    if (item.completedAt) {
      replaceCompleted(item.id, item)
    } else {
      replace(item.id, item)
    }
    return null
  }

  /** Done tab: un-tick a completed one-time task to reopen it (removes its latest completion). */
  async function reopen(task: TaskListItem) {
    const before = { ...task }
    replaceCompleted(task.id, null)
    replace(task.id, {
      ...task,
      completedAt: null,
    })
    const { error: reopenError } = await supabase.rpc('uncomplete_task', { p_task_id: task.id }).single()
    if (reopenError) {
      replace(task.id, null)
      replaceCompleted(task.id, before)
      toast.error(taskErrorMessage(reopenError.message))
      return
    }
    toast(`Reopened “${task.title}”`)
  }

  async function deleteNow(id: string) {
    pendingDeletes.delete(id)
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', id)
    if (deleteError) {
      toast.error('Could not delete the task.')
    } else {
      replace(id, null)
      replaceCompleted(id, null)
    }
    const next = new Set(hiddenIds.value)
    next.delete(id)
    hiddenIds.value = next
  }

  function flushDeletes() {
    for (const [id, timer] of pendingDeletes) {
      clearTimeout(timer)
      void deleteNow(id)
    }
  }

  /**
   * Delete with undo (features/TASKS.md §10): the row disappears at once, the delete (which also removes the
   * task's history) runs when the undo window ends, so Undo loses nothing.
   */
  function deleteTask(task: TaskListItem) {
    hiddenIds.value = new Set([...hiddenIds.value, task.id])
    pendingDeletes.set(task.id, setTimeout(() => void deleteNow(task.id), UNDO_TOAST_MS))
    toast(`Deleted “${task.title}”`, {
      duration: UNDO_TOAST_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(pendingDeletes.get(task.id))
          pendingDeletes.delete(task.id)
          const next = new Set(hiddenIds.value)
          next.delete(task.id)
          hiddenIds.value = next
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
    saveTask,
    deleteTask,
    completedTasks,
    completedLoaded,
    completedPending,
    loadCompleted,
    reopen,
    timezone,
  }
}
