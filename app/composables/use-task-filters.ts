import { EMPTY_FACETS, type TaskFacets, type TaskStatusFilter } from '#shared/task-filter'

/** Task list filter state (TASKS-009), kept while navigating between the app's pages. */
export function useTaskFilters() {
  const status = useState<TaskStatusFilter>('task-filter-status', () => 'all')
  const facets = useState<TaskFacets>('task-filter-facets', () => ({ ...EMPTY_FACETS }))
  /** The Filters sheet. */
  const filtersOpen = useState('task-filters-open', () => false)

  function setFacet<K extends keyof TaskFacets>(key: K, value: TaskFacets[K]) {
    facets.value = { ...facets.value, [key]: value }
  }

  /** Room, category, assignee and type back to "any" (the search text stays). */
  function clearFacets() {
    facets.value = { ...EMPTY_FACETS, query: facets.value.query }
  }

  /** Filters and search text. */
  function clearAll() {
    facets.value = { ...EMPTY_FACETS }
  }

  return {
    status,
    facets,
    filtersOpen,
    setFacet,
    clearFacets,
    clearAll,
  }
}
