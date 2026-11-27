/**
 * Pure helpers for the task list (features/TASKS.md §6): due labels, default sort, recurrence text.
 * Dates are household-local `YYYY-MM-DD` strings; `today` comes from `localToday(household.timezone)`.
 */
import { daysBetween, type RecurrenceUnit } from './recurrence'

export type DueTone = 'overdue' | 'today' | 'soon' | 'later'

export interface DueLabel {
  /** Short text for the row: "Today", "in 3 d", "3 d overdue", "Dec 14". */
  text: string
  /** Long form for screen readers and tooltips: "Due today", "3 days overdue", "Due Monday, December 14". */
  description: string
  tone: DueTone
}

/** Up to this many days ahead the label is relative ("in 9 d"); later ones show the date. */
const RELATIVE_DAYS = 13

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function formatDate(date: string, today: string, style: 'short' | 'long'): string {
  const [y, m, d] = date.split('-').map(Number)
  const sameYear = date.slice(0, 4) === today.slice(0, 4)
  // UTC so the calendar date never shifts with the viewer's timezone.
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: style === 'long' ? 'long' : undefined,
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  }).format(new Date(Date.UTC(y!, m! - 1, d!)))
}

/** Label for a due date relative to `today`; null when the task has no due date (never overdue). */
export function dueLabel(dueDate: string | null, today: string): DueLabel | null {
  if (!dueDate) {
    return null
  }
  const days = daysBetween(today, dueDate)
  if (days < 0) {
    return {
      text: `${-days} d overdue`,
      description: `${plural(-days, 'day')} overdue`,
      tone: 'overdue',
    }
  }
  if (days === 0) {
    return {
      text: 'Today',
      description: 'Due today',
      tone: 'today',
    }
  }
  if (days === 1) {
    return {
      text: 'Tomorrow',
      description: 'Due tomorrow',
      tone: 'soon',
    }
  }
  if (days <= RELATIVE_DAYS) {
    return {
      text: `in ${days} d`,
      description: `Due in ${plural(days, 'day')}, ${formatDate(dueDate, today, 'long')}`,
      tone: days <= 6 ? 'soon' : 'later',
    }
  }
  return {
    text: formatDate(dueDate, today, 'short'),
    description: `Due ${formatDate(dueDate, today, 'long')}`,
    tone: 'later',
  }
}

/** "Daily", "Every 2 days", "Weekly", "Every 3 months", "Yearly". */
export function describeRecurrence(unit: RecurrenceUnit, interval: number): string {
  if (interval === 1) {
    const single: Record<RecurrenceUnit, string> = {
      day: 'Daily',
      week: 'Weekly',
      month: 'Monthly',
      year: 'Yearly',
    }
    return single[unit]
  }
  return `Every ${plural(interval, unit)}`
}

export interface SortableTask {
  dueDate: string | null
  title: string
  createdAt: string
}

/**
 * Default order: overdue → due soonest → undated (features/TASKS.md §6). Overdue tasks have the earliest dates,
 * so this is due date ascending with undated last; ties by title, then oldest first. Returns a new array.
 */
export function sortTasks<T extends SortableTask>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) {
        return 1
      }
      if (b.dueDate === null) {
        return -1
      }
      return a.dueDate < b.dueDate ? -1 : 1
    }
    const byTitle = a.title.localeCompare(b.title)
    if (byTitle !== 0) {
      return byTitle
    }
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
  })
}
