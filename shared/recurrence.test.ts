import { describe, expect, it } from 'vitest'
import {
  addDays,
  addInterval,
  addMonths,
  daysBetween,
  daysInMonth,
  isLeapYear,
  isValidIsoDate,
  localToday,
  nextDueDate,
  type RecurrenceUnit,
} from './recurrence'

describe('calendar helpers', () => {
  it.each([
    [2024, true],
    [2026, false],
    [2028, true],
    [1900, false],
    [2000, true],
    [2100, false],
  ])('isLeapYear(%i) = %s', (year, leap) => {
    expect(isLeapYear(year)).toBe(leap)
  })

  it.each([
    [2026, 1, 31],
    [2026, 2, 28],
    [2028, 2, 29],
    [2026, 4, 30],
    [2026, 12, 31],
  ])('daysInMonth(%i, %i) = %i', (year, month, days) => {
    expect(daysInMonth(year, month)).toBe(days)
  })

  it('validates ISO dates', () => {
    for (const ok of ['2026-01-01', '2028-02-29', '2026-12-31']) {
      expect(isValidIsoDate(ok), ok).toBe(true)
    }
    for (const bad of ['2026-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-1-1', '26-01-01', '', 'today', '2026-01-01T00:00']) {
      expect(isValidIsoDate(bad), bad).toBe(false)
      expect(() => addDays(bad, 1), bad).toThrow(RangeError)
    }
  })
})

describe('days and weeks: exact, across month/year/leap boundaries', () => {
  it.each<[string, RecurrenceUnit, number, string]>([
    ['2026-11-28', 'day', 1, '2026-11-29'],
    ['2026-11-30', 'day', 1, '2026-12-01'],
    ['2026-12-31', 'day', 1, '2027-01-01'],
    ['2028-02-28', 'day', 1, '2028-02-29'],
    ['2028-02-29', 'day', 1, '2028-03-01'],
    ['2027-02-28', 'day', 1, '2027-03-01'],
    ['2026-01-01', 'day', 365, '2027-01-01'],
    ['2028-01-01', 'day', 365, '2028-12-31'],
    ['2026-11-28', 'week', 1, '2026-12-05'],
    ['2026-12-28', 'week', 1, '2027-01-04'],
    ['2028-02-25', 'week', 1, '2028-03-03'],
    ['2026-01-01', 'week', 52, '2026-12-31'],
    // Around DST changes (dates have no time of day, so nothing shifts).
    ['2026-03-26', 'day', 1, '2026-03-27'],
    ['2026-03-28', 'week', 1, '2026-04-04'],
    ['2026-10-24', 'day', 2, '2026-10-26'],
  ])('%s + (%s × %i) = %s', (date, unit, n, expected) => {
    expect(addInterval(date, unit, n)).toBe(expected)
  })

  it('subtracts with negative days', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })
})

describe('months: clamp to the last day of the target month', () => {
  it.each<[string, number, string]>([
    ['2026-01-15', 1, '2026-02-15'],
    ['2026-01-31', 1, '2026-02-28'],
    ['2028-01-31', 1, '2028-02-29'],
    ['2026-03-31', 1, '2026-04-30'],
    ['2026-05-31', 1, '2026-06-30'],
    ['2026-08-31', 1, '2026-09-30'],
    ['2026-10-31', 1, '2026-11-30'],
    ['2026-12-31', 1, '2027-01-31'],
    ['2026-11-30', 3, '2027-02-28'],
    ['2027-11-30', 3, '2028-02-29'],
    ['2026-08-31', 6, '2027-02-28'],
    ['2026-01-29', 1, '2026-02-28'],
    ['2026-12-15', 13, '2028-01-15'],
    ['2026-06-30', 24, '2028-06-30'],
    ['2026-03-31', -1, '2026-02-28'],
  ])('%s + %i month(s) = %s', (date, months, expected) => {
    expect(addMonths(date, months)).toBe(expected)
    expect(addInterval(date, 'month', months)).toBe(expected)
  })

  it('has no drift memory (documented limitation): Jan 31 → Feb 28 → Mar 28', () => {
    const feb = addInterval('2026-01-31', 'month', 1)
    expect(feb).toBe('2026-02-28')
    expect(addInterval(feb, 'month', 1)).toBe('2026-03-28')
  })
})

describe('years: +12 months; Feb 29 clamps to Feb 28', () => {
  it.each<[string, number, string]>([
    ['2026-11-28', 1, '2027-11-28'],
    ['2028-02-29', 1, '2029-02-28'],
    ['2028-02-29', 4, '2032-02-29'],
    ['2027-02-28', 1, '2028-02-28'],
    ['2026-12-31', 1, '2027-12-31'],
    ['2026-01-01', 10, '2036-01-01'],
  ])('%s + %i year(s) = %s', (date, years, expected) => {
    expect(addInterval(date, 'year', years)).toBe(expected)
  })
})

describe('nextDueDate: anchored on the completion date (D10)', () => {
  // Task "Clean AC filters", every 3 months, due 2026-03-10.
  it('on time: due date + interval', () => {
    expect(nextDueDate('2026-03-10', 'month', 3)).toBe('2026-06-10')
  })

  it('early completion counts from the actual completion day', () => {
    expect(nextDueDate('2026-03-01', 'month', 3)).toBe('2026-06-01')
  })

  it('late completion counts from the completion day; missed occurrences are not back-filled', () => {
    // Due 2026-03-10, done 2026-08-20 (one whole occurrence missed): next is 3 months after completion.
    expect(nextDueDate('2026-08-20', 'month', 3)).toBe('2026-11-20')
  })

  it('weekly "Water plants" done a day late', () => {
    expect(nextDueDate('2026-11-29', 'week', 1)).toBe('2026-12-06')
  })

  it('yearly "Prepare balcony for winter"', () => {
    expect(nextDueDate('2026-11-01', 'year', 1)).toBe('2027-11-01')
  })

  it('rejects intervals outside the database bounds', () => {
    expect(() => nextDueDate('2026-01-01', 'day', 0)).toThrow(RangeError)
    expect(() => nextDueDate('2026-01-01', 'day', 1000)).toThrow(RangeError)
    expect(() => nextDueDate('2026-01-01', 'day', 1.5)).toThrow(RangeError)
    expect(nextDueDate('2026-01-01', 'day', 999)).toBe('2028-09-26')
  })
})

describe('localToday: "today" in the household timezone', () => {
  // 22:30 UTC on 2026-03-01.
  const lateEvening = new Date('2026-03-01T22:30:00Z')

  it.each([
    ['UTC', '2026-03-01'],
    ['Asia/Jerusalem', '2026-03-02'], // UTC+2
    ['Europe/London', '2026-03-01'],
    ['America/Los_Angeles', '2026-03-01'],
    ['Pacific/Kiritimati', '2026-03-02'], // UTC+14
    ['Asia/Kolkata', '2026-03-02'], // UTC+5:30 → 04:00
  ])('%s → %s', (tz, expected) => {
    expect(localToday(tz, lateEvening)).toBe(expected)
  })

  it('early morning UTC is still yesterday in the Americas', () => {
    const early = new Date('2026-07-01T03:00:00Z')
    expect(localToday('America/New_York', early)).toBe('2026-06-30') // UTC-4 (summer)
    expect(localToday('Asia/Jerusalem', early)).toBe('2026-07-01')
  })

  it('handles DST days and New Year', () => {
    // Israel moves clocks forward on 2026-03-27; Europe on 2026-03-29.
    expect(localToday('Asia/Jerusalem', new Date('2026-03-26T22:30:00Z'))).toBe('2026-03-27')
    expect(localToday('Europe/Berlin', new Date('2026-03-29T00:30:00Z'))).toBe('2026-03-29')
    expect(localToday('Asia/Jerusalem', new Date('2026-12-31T22:00:00Z'))).toBe('2027-01-01')
  })

  it('throws for an unknown timezone', () => {
    expect(() => localToday('Mars/Base')).toThrow(RangeError)
  })
})

describe('daysBetween', () => {
  it.each([
    ['2026-11-28', '2026-11-28', 0],
    ['2026-11-28', '2026-12-01', 3],
    ['2026-12-01', '2026-11-28', -3],
    ['2028-02-28', '2028-03-01', 2],
    ['2026-03-28', '2026-03-30', 2], // across a DST change
    ['2026-01-01', '2027-01-01', 365],
  ])('%s → %s = %i', (from, to, days) => {
    expect(daysBetween(from, to)).toBe(days)
  })
})
