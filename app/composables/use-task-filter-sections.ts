import type { Component, Ref } from 'vue'
import { DoorOpenIcon, ListChecksIcon, TagIcon, UserRoundIcon } from '@lucide/vue'
import type { HouseholdMember } from '~/composables/use-household-members'
import type { TaskListValue } from '~/composables/use-task-list'
import { UNASSIGNED, type TaskFacets } from '#shared/task-filter'

/** The facets the Filters sheet edits (search text is separate). */
export type FilterFacetKey = 'roomId' | 'categoryId' | 'assignee' | 'kind'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterSection {
  key: FilterFacetKey
  label: string
  /** Same icons as the task row meta, so filters and rows read alike. */
  icon: Component
  options: FilterOption[]
}

export interface ActiveFilter {
  key: FilterFacetKey
  icon: Component
  /** e.g. "Room", for screen readers ("Remove filter Room: Bathroom"). */
  sectionLabel: string
  label: string
}

/**
 * The Filters sheet sections (room, category, assignee, type) and the active filters shown as chips under the
 * search box. "Any" is the empty choice and is not listed as an option.
 */
export function useTaskFilterSections(
  rooms: Ref<TaskListValue[]>,
  categories: Ref<TaskListValue[]>,
  members: Ref<HouseholdMember[]>,
) {
  const { facets } = useTaskFilters()

  const sections = computed<FilterSection[]>(() => [
    {
      key: 'roomId',
      label: 'Room',
      icon: DoorOpenIcon,
      options: rooms.value.map(r => ({
        value: r.id,
        label: r.name,
      })),
    },
    {
      key: 'categoryId',
      label: 'Category',
      icon: TagIcon,
      options: categories.value.map(c => ({
        value: c.id,
        label: c.name,
      })),
    },
    {
      key: 'assignee',
      label: 'Assigned to',
      icon: UserRoundIcon,
      options: [
        ...members.value.map(m => ({
          value: m.id,
          label: m.displayName,
        })),
        {
          value: UNASSIGNED,
          label: 'Unassigned',
        },
      ],
    },
    {
      key: 'kind',
      label: 'Type',
      icon: ListChecksIcon,
      options: [
        {
          value: 'one_time',
          label: 'One-time',
        },
        {
          value: 'recurring',
          label: 'Repeating',
        },
      ],
    },
  ])

  const activeFilters = computed<ActiveFilter[]>(() =>
    sections.value.flatMap((section) => {
      const value = facets.value[section.key]
      if (value === null) {
        return []
      }
      return [{
        key: section.key,
        icon: section.icon,
        sectionLabel: section.label,
        // A value deleted meanwhile (e.g. a removed room) still shows, so it can be cleared.
        label: section.options.find(o => o.value === value)?.label ?? 'Removed',
      }]
    }),
  )

  /** Set one facet; '' or null means "any". */
  function setFilter(key: FilterFacetKey, value: string | null) {
    const next: TaskFacets = { ...facets.value }
    if (key === 'kind') {
      next.kind = value === 'one_time' || value === 'recurring' ? value : null
    } else {
      next[key] = value || null
    }
    facets.value = next
  }

  return {
    sections,
    activeFilters,
    setFilter,
  }
}
