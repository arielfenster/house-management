/**
 * Task list filters and search (features/TASKS.md §5, TASKS-009). Pure functions; dates are household-local
 * `YYYY-MM-DD` strings and `today` comes from `localToday(household.timezone)`.
 *
 * Status (for open tasks):
 *   all       every open task
 *   upcoming  has a due date, today or later
 *   overdue   due date before today (undated tasks are never overdue)
 * "completed" is a separate list (completed one-time tasks), not computed from open tasks.
 * Facets (room, category, assignee, type) and the search text apply on top of any status.
 */

export const TASK_STATUS_FILTERS = ['all', 'upcoming', 'overdue', 'completed'] as const
export type TaskStatusFilter = (typeof TASK_STATUS_FILTERS)[number]
export type OpenTaskStatusFilter = Exclude<TaskStatusFilter, 'completed'>

/** Assignee facet value for tasks assigned to nobody. */
export const UNASSIGNED = 'unassigned'

export interface TaskFacets {
  categoryId: string | null
  roomId: string | null
  /** A member id, UNASSIGNED, or null for anyone. */
  assignee: string | null
  kind: 'one_time' | 'recurring' | null
  /** Free text over title and notes. */
  query: string
}

export interface FilterableTask {
  title: string
  description: string | null
  dueDate: string | null
  kind: 'one_time' | 'recurring'
  categoryId: string | null
  roomId: string | null
  assignedTo: string | null
}

export const EMPTY_FACETS: TaskFacets = {
  categoryId: null,
  roomId: null,
  assignee: null,
  kind: null,
  query: '',
}

/** Number of facets in use (for the filter button badge); search text is shown separately. */
export function activeFacetCount(facets: TaskFacets): number {
  return [facets.categoryId, facets.roomId, facets.assignee, facets.kind].filter(value => value !== null).length
}

export function matchesStatus(task: FilterableTask, status: OpenTaskStatusFilter, today: string): boolean {
  switch (status) {
    case 'all':
      return true
    case 'upcoming':
      return task.dueDate !== null && task.dueDate >= today
    case 'overdue':
      return task.dueDate !== null && task.dueDate < today
  }
}

/** Case-insensitive; every word must appear in the title or notes ("ac filter" finds "Clean AC filters"). */
export function matchesQuery(task: FilterableTask, query: string): boolean {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) {
    return true
  }
  const haystack = `${task.title}\n${task.description ?? ''}`.toLocaleLowerCase()
  return words.every(word => haystack.includes(word))
}

export function matchesFacets(task: FilterableTask, facets: TaskFacets): boolean {
  return (facets.categoryId === null || task.categoryId === facets.categoryId)
    && (facets.roomId === null || task.roomId === facets.roomId)
    && (facets.assignee === null
      || (facets.assignee === UNASSIGNED ? task.assignedTo === null : task.assignedTo === facets.assignee))
    && (facets.kind === null || task.kind === facets.kind)
    && matchesQuery(task, facets.query)
}

export function filterTasks<T extends FilterableTask>(
  tasks: readonly T[],
  status: OpenTaskStatusFilter,
  facets: TaskFacets,
  today: string,
): T[] {
  return tasks.filter(task => matchesStatus(task, status, today) && matchesFacets(task, facets))
}

/** Tab counts for the open statuses, with the current facets and search applied. */
export function countByStatus(
  tasks: readonly FilterableTask[],
  facets: TaskFacets,
  today: string,
): Record<OpenTaskStatusFilter, number> {
  const visible = tasks.filter(task => matchesFacets(task, facets))
  return {
    all: visible.length,
    upcoming: visible.filter(task => matchesStatus(task, 'upcoming', today)).length,
    overdue: visible.filter(task => matchesStatus(task, 'overdue', today)).length,
  }
}
