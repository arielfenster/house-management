/**
 * Pure helpers for the task list (features/TASKS.md §6): due labels, default sort, recurrence text.
 * Dates are household-local `YYYY-MM-DD` strings; `today` comes from `localToday(household.timezone)`.
 */
import { daysBetween, isValidIsoDate, localToday, type RecurrenceUnit } from './recurrence'

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

/** "every week", "every 2 weeks" (lower case, for use inside a sentence). */
function everyPhrase(unit: RecurrenceUnit, interval: number): string {
  return interval === 1 ? `every ${unit}` : `every ${plural(interval, unit)}`
}

/**
 * One-sentence preview of a repeating task's schedule for the form (D10): the chosen date is just the next
 * occurrence; after that, each completion schedules the next one an interval later.
 * "Due tomorrow, then every week after each completion." / "Due Sun, Dec 6, then every 3 months after each completion."
 * Null when the values are not valid yet (the form shows field errors instead).
 */
export function describeSchedule(dueDate: string, unit: RecurrenceUnit, interval: number, today: string): string | null {
  if (!isValidIsoDate(dueDate) || !Number.isInteger(interval) || interval < 1) {
    return null
  }
  const days = daysBetween(today, dueDate)
  let when: string
  if (days === 0) {
    when = 'Due today'
  } else if (days === 1) {
    when = 'Due tomorrow'
  } else {
    const [y, m, d] = dueDate.split('-').map(Number)
    const sameYear = dueDate.slice(0, 4) === today.slice(0, 4)
    when = `${days < 0 ? 'Overdue since' : 'Due'} ${new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: sameYear ? undefined : 'numeric',
    }).format(new Date(Date.UTC(y!, m! - 1, d!)))}`
  }
  return `${when}, then ${everyPhrase(unit, interval)} after each completion.`
}

/**
 * When a completed task was done, for its row: "Done today", "Done yesterday", "Done Nov 27" (with the year if it
 * differs). `completedAt` is an instant; it is shown as a date in the household timezone.
 */
export function doneLabel(completedAt: string, timeZone: string, today: string): string {
  const day = localToday(timeZone, new Date(completedAt))
  const days = daysBetween(day, today)
  if (days === 0) {
    return 'Done today'
  }
  if (days === 1) {
    return 'Done yesterday'
  }
  return `Done ${formatDate(day, today, 'short')}`
}

export type CompletionTiming = 'early' | 'on_time' | 'late'

export interface CompletionDescription {
  /** The completion day: "Today", "Yesterday", "Nov 20" (with the year if it differs). */
  date: string
  /** Null when the task had no due date. */
  timing: CompletionTiming | null
  /** "On time", "2 days late", "1 day early"; null without a due date. */
  timingText: string | null
}

/**
 * One history entry (TASKS-010): when it was done (household timezone) and how that compares with the date it
 * was due (`due_date_at_completion`).
 */
export function describeCompletion(
  completedAt: string,
  dueDateAtCompletion: string | null,
  timeZone: string,
  today: string,
): CompletionDescription {
  const day = localToday(timeZone, new Date(completedAt))
  const ago = daysBetween(day, today)
  const date = ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : formatDate(day, today, 'short')
  if (!dueDateAtCompletion) {
    return {
      date,
      timing: null,
      timingText: null,
    }
  }
  const late = daysBetween(dueDateAtCompletion, day)
  if (late === 0) {
    return {
      date,
      timing: 'on_time',
      timingText: 'On time',
    }
  }
  return {
    date,
    timing: late > 0 ? 'late' : 'early',
    timingText: late > 0 ? `${plural(late, 'day')} late` : `${plural(-late, 'day')} early`,
  }
}
