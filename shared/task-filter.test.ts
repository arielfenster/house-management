import { describe, expect, it } from 'vitest'
import {
  EMPTY_FACETS,
  activeFacetCount,
  countByStatus,
  filterTasks,
  matchesQuery,
  type FilterableTask,
  type TaskFacets,
} from './task-filter'

const TODAY = '2026-11-28'
const CLEANING = 'c1'
const MAINTENANCE = 'c2'
const KITCHEN = 'r1'
const BALCONY = 'r2'

function task(title: string, fields: Partial<FilterableTask> = {}): FilterableTask & { title: string } {
  return {
    title,
    description: null,
    dueDate: null,
    kind: 'one_time',
    categoryId: null,
    roomId: null,
    ...fields,
  }
}

const TASKS = [
  task('Clean AC filters', { dueDate: '2026-11-24', kind: 'recurring', categoryId: MAINTENANCE }),
  task('Water plants', { dueDate: TODAY, kind: 'recurring', roomId: BALCONY }),
  task('Descale the kettle', { dueDate: '2026-12-07', kind: 'recurring', categoryId: CLEANING, roomId: KITCHEN }),
  task('Fix bathroom faucet', { dueDate: '2026-11-30', categoryId: MAINTENANCE, description: 'Buy a new washer' }),
  task('Call the plumber', { categoryId: MAINTENANCE }),
  task('לקנות מנורה לסלון'),
]

const titles = (tasks: { title: string }[]) => tasks.map(t => t.title)
const facets = (f: Partial<TaskFacets>) => ({ ...EMPTY_FACETS, ...f })

describe('status', () => {
  it('all = every open task', () => {
    expect(filterTasks(TASKS, 'all', EMPTY_FACETS, TODAY)).toHaveLength(6)
  })

  it('upcoming = dated today or later; overdue = dated before today; undated is neither', () => {
    expect(titles(filterTasks(TASKS, 'upcoming', EMPTY_FACETS, TODAY))).toEqual(['Water plants', 'Descale the kettle', 'Fix bathroom faucet'])
    expect(titles(filterTasks(TASKS, 'overdue', EMPTY_FACETS, TODAY))).toEqual(['Clean AC filters'])
  })

  it('a task due today becomes overdue tomorrow', () => {
    expect(titles(filterTasks(TASKS, 'overdue', EMPTY_FACETS, '2026-11-29'))).toEqual(['Clean AC filters', 'Water plants'])
  })
})

describe('facets', () => {
  it('category, room and type combine with AND', () => {
    expect(titles(filterTasks(TASKS, 'all', facets({ categoryId: MAINTENANCE }), TODAY))).toEqual(['Clean AC filters', 'Fix bathroom faucet', 'Call the plumber'])
    expect(titles(filterTasks(TASKS, 'all', facets({ categoryId: MAINTENANCE, kind: 'one_time' }), TODAY))).toEqual(['Fix bathroom faucet', 'Call the plumber'])
    expect(titles(filterTasks(TASKS, 'all', facets({ roomId: KITCHEN }), TODAY))).toEqual(['Descale the kettle'])
    expect(titles(filterTasks(TASKS, 'upcoming', facets({ kind: 'recurring' }), TODAY))).toEqual(['Water plants', 'Descale the kettle'])
  })

  it('counts the active facets (not the search text)', () => {
    expect(activeFacetCount(EMPTY_FACETS)).toBe(0)
    expect(activeFacetCount(facets({ categoryId: CLEANING, kind: 'recurring', query: 'x' }))).toBe(2)
  })
})

describe('search', () => {
  it('matches title and notes, ignoring case; every word must match', () => {
    expect(titles(filterTasks(TASKS, 'all', facets({ query: 'ac FILTER' }), TODAY))).toEqual(['Clean AC filters'])
    expect(titles(filterTasks(TASKS, 'all', facets({ query: 'washer' }), TODAY))).toEqual(['Fix bathroom faucet'])
    expect(titles(filterTasks(TASKS, 'all', facets({ query: 'plumber faucet' }), TODAY))).toEqual([])
  })

  it('finds Hebrew text', () => {
    expect(titles(filterTasks(TASKS, 'all', facets({ query: 'מנורה' }), TODAY))).toEqual(['לקנות מנורה לסלון'])
  })

  it('blank search matches everything', () => {
    expect(matchesQuery(TASKS[0]!, '   ')).toBe(true)
  })
})

describe('countByStatus', () => {
  it('counts each open status with facets and search applied', () => {
    expect(countByStatus(TASKS, EMPTY_FACETS, TODAY)).toEqual({ all: 6, upcoming: 3, overdue: 1 })
    expect(countByStatus(TASKS, facets({ categoryId: MAINTENANCE }), TODAY)).toEqual({ all: 3, upcoming: 1, overdue: 1 })
    expect(countByStatus(TASKS, facets({ query: 'kettle' }), TODAY)).toEqual({ all: 1, upcoming: 1, overdue: 0 })
  })
})
