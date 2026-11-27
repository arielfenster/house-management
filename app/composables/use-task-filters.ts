import { EMPTY_FACETS, type TaskFacets, type TaskStatusFilter } from '#shared/task-filter'

/** Task list filter state (TASKS-009), kept while navigating between the app's pages. */
export function useTaskFilters() {
  const status = useState<TaskStatusFilter>('task-filter-status', () => 'all')
  const facets = useState<TaskFacets>('task-filter-facets', () => ({ ...EMPTY_FACETS }))
  const searchOpen = useState('task-search-open', () => false)
  const filtersOpen = useState('task-filters-open', () => false)

  function clearFacets() {
    facets.value = { ...EMPTY_FACETS, query: facets.value.query }
  }

  function clearAll() {
    facets.value = { ...EMPTY_FACETS }
    searchOpen.value = false
  }

  return {
    status,
    facets,
    searchOpen,
    filtersOpen,
    clearFacets,
    clearAll,
  }
}
