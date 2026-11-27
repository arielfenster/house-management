import * as v from 'valibot'
import { taskListNameSchema } from '#shared/validation/task'

/** The household's task categories or rooms (D3: per household, seeded with defaults, freely editable). */
export type TaskListTable = 'task_categories' | 'rooms'

export interface TaskListValue {
  id: string
  name: string
}

export type TaskListResult =
  | { ok: true, value: TaskListValue }
  | { ok: false, message: string }

/** Postgres error → message for the inline editor. */
function listErrorMessage(code: string | undefined): string {
  return code === '23505' ? 'That name already exists.' : 'Could not save. Please try again.'
}

/**
 * Load, create, rename and delete categories or rooms (TASKS-008). Any member may manage them (RLS).
 * Deleting one clears it on tasks (`on delete set null`); callers refresh the task list after rename/delete.
 */
export function useTaskList(table: TaskListTable) {
  const supabase = useSupabaseClient()
  const { membership } = useMembership()
  const householdId = computed(() => membership.value?.householdId ?? null)

  const { data, refresh } = useAsyncData(
    `task-list-${table}`,
    async (): Promise<TaskListValue[]> => {
      if (!householdId.value) {
        return []
      }
      const { data: rows, error } = await supabase
        .from(table)
        .select('id, name')
        .eq('household_id', householdId.value)
      if (error) {
        return []
      }
      return rows.sort((a, b) => a.name.localeCompare(b.name))
    },
    {
      watch: [householdId],
      default: () => [],
    },
  )

  function sorted(values: TaskListValue[]): TaskListValue[] {
    return [...values].sort((a, b) => a.name.localeCompare(b.name))
  }

  async function create(rawName: string): Promise<TaskListResult> {
    const name = v.safeParse(taskListNameSchema, rawName)
    if (!name.success) {
      return {
        ok: false,
        message: name.issues[0].message,
      }
    }
    if (!householdId.value) {
      return {
        ok: false,
        message: listErrorMessage(undefined),
      }
    }
    const { data: row, error } = await supabase
      .from(table)
      .insert({ household_id: householdId.value, name: name.output })
      .select('id, name')
      .single()
    if (error || !row) {
      return {
        ok: false,
        message: listErrorMessage(error?.code),
      }
    }
    data.value = sorted([...data.value, row])
    return {
      ok: true,
      value: row,
    }
  }

  async function rename(id: string, rawName: string): Promise<TaskListResult> {
    const name = v.safeParse(taskListNameSchema, rawName)
    if (!name.success) {
      return {
        ok: false,
        message: name.issues[0].message,
      }
    }
    const { data: row, error } = await supabase
      .from(table)
      .update({ name: name.output })
      .eq('id', id)
      .select('id, name')
      .single()
    if (error || !row) {
      return {
        ok: false,
        message: listErrorMessage(error?.code),
      }
    }
    data.value = sorted(data.value.map(item => (item.id === id ? row : item)))
    return {
      ok: true,
      value: row,
    }
  }

  /** Resolves to an error message, or null when deleted. */
  async function remove(id: string): Promise<string | null> {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) {
      return 'Could not delete. Please try again.'
    }
    data.value = data.value.filter(item => item.id !== id)
    return null
  }

  return {
    values: data,
    refresh,
    create,
    rename,
    remove,
  }
}
