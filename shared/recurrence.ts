/**
 * Recurrence date math (features/TASKS.md §9, D10). Pure functions, shared by the server route that completes
 * tasks and by the UI.
 *
 * All dates are local calendar dates in the household timezone, as `YYYY-MM-DD` strings (Postgres `date`).
 * There is no time of day, so DST never matters. Arithmetic runs on UTC midnights, which have no DST either.
 */

export const RECURRENCE_UNITS = ['day', 'week', 'month', 'year'] as const
export type RecurrenceUnit = (typeof RECURRENCE_UNITS)[number]

/** Same bounds as the `tasks.recurrence_interval` check constraint. */
export const RECURRENCE_INTERVAL_MIN = 1
export const RECURRENCE_INTERVAL_MAX = 999

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 24 * 60 * 60 * 1000

export function isRecurrenceUnit(value: unknown): value is RecurrenceUnit {
  return typeof value === 'string' && (RECURRENCE_UNITS as readonly string[]).includes(value)
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Days in `month` (1–12) of `year`. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

interface DateParts {
  year: number
  month: number
  day: number
}

/** Parses `YYYY-MM-DD`; throws on anything else, including impossible dates like `2026-02-30`. */
function parse(date: string): DateParts {
  const match = ISO_DATE.exec(date)
  if (!match) {
    throw new RangeError(`Invalid date: ${date}`)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Invalid date: ${date}`)
  }
  return {
    year,
    month,
    day,
  }
}

function format({ year, month, day }: DateParts): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function toUtcMs(date: string): number {
  const { year, month, day } = parse(date)
  return Date.UTC(year, month - 1, day)
}

function fromUtcMs(ms: number): string {
  const d = new Date(ms)
  return format({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  })
}

export function isValidIsoDate(date: string): boolean {
  try {
    parse(date)
    return true
  } catch {
    return false
  }
}

/** `date` plus `days` (may be negative). */
export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS)
}

/**
 * `date` plus `months`, clamping the day to the target month's last day (Jan 31 + 1 month = Feb 28/29).
 * No drift memory: Jan 31 → Feb 28 → Mar 28 (documented limitation, features/TASKS.md §9).
 */
export function addMonths(date: string, months: number): string {
  const { year, month, day } = parse(date)
  const total = year * 12 + (month - 1) + months
  const targetYear = Math.floor(total / 12)
  const targetMonth = (total % 12) + 1
  return format({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, daysInMonth(targetYear, targetMonth)),
  })
}

/** `date` plus `interval` units: days/weeks are exact, months/years clamp the day (Feb 29 + 1 year = Feb 28). */
export function addInterval(date: string, unit: RecurrenceUnit, interval: number): string {
  if (!Number.isInteger(interval)) {
    throw new RangeError(`Invalid interval: ${interval}`)
  }
  switch (unit) {
    case 'day':
      return addDays(date, interval)
    case 'week':
      return addDays(date, interval * 7)
    case 'month':
      return addMonths(date, interval)
    case 'year':
      return addMonths(date, interval * 12)
  }
}

/**
 * Next due date of a recurring task completed on `completionDate` (local date in the household timezone).
 * D10: always counted from the completion day, for early and late completions alike; missed occurrences are
 * never back-filled.
 */
export function nextDueDate(completionDate: string, unit: RecurrenceUnit, interval: number): string {
  if (interval < RECURRENCE_INTERVAL_MIN || interval > RECURRENCE_INTERVAL_MAX) {
    throw new RangeError(`Invalid interval: ${interval}`)
  }
  return addInterval(completionDate, unit, interval)
}

/** Today's date in an IANA timezone (`Asia/Jerusalem`), as `YYYY-MM-DD`. */
export function localToday(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value)
  return format({
    year: get('year'),
    month: get('month'),
    day: get('day'),
  })
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS)
}
