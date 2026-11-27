import { describe, expect, it } from 'vitest'
import { describeRecurrence, describeSchedule, doneLabel, dueLabel, sortTasks } from './task-list'

const TODAY = '2026-11-28'

describe('dueLabel', () => {
  it('is null without a due date', () => {
    expect(dueLabel(null, TODAY)).toBeNull()
  })

  it.each([
    ['2026-11-27', '1 d overdue', '1 day overdue', 'overdue'],
    ['2026-11-18', '10 d overdue', '10 days overdue', 'overdue'],
    ['2026-11-28', 'Today', 'Due today', 'today'],
    ['2026-11-29', 'Tomorrow', 'Due tomorrow', 'soon'],
    ['2026-12-01', 'in 3 d', 'Due in 3 days, Tuesday, December 1', 'soon'],
    ['2026-12-04', 'in 6 d', 'Due in 6 days, Friday, December 4', 'soon'],
    ['2026-12-05', 'in 7 d', 'Due in 7 days, Saturday, December 5', 'later'],
    ['2026-12-11', 'in 13 d', 'Due in 13 days, Friday, December 11', 'later'],
    ['2026-12-12', 'Dec 12', 'Due Saturday, December 12', 'later'],
    ['2027-02-28', 'Feb 28, 2027', 'Due Sunday, February 28, 2027', 'later'],
  ])('%s → "%s"', (due, text, description, tone) => {
    expect(dueLabel(due, TODAY)).toEqual({ text, description, tone })
  })

  it('counts calendar days across a year boundary', () => {
    expect(dueLabel('2027-01-02', '2026-12-31')?.text).toBe('in 2 d')
    expect(dueLabel('2026-12-30', '2027-01-01')?.text).toBe('2 d overdue')
  })
})

describe('describeRecurrence', () => {
  it.each([
    ['day', 1, 'Daily'],
    ['day', 2, 'Every 2 days'],
    ['week', 1, 'Weekly'],
    ['week', 2, 'Every 2 weeks'],
    ['month', 1, 'Monthly'],
    ['month', 3, 'Every 3 months'],
    ['year', 1, 'Yearly'],
    ['year', 5, 'Every 5 years'],
  ] as const)('%s ×%i → %s', (unit, interval, text) => {
    expect(describeRecurrence(unit, interval)).toBe(text)
  })
})

describe('sortTasks', () => {
  const task = (title: string, dueDate: string | null, createdAt = '2026-11-01T00:00:00Z') => ({ title, dueDate, createdAt })

  it('overdue first, then soonest due, undated last', () => {
    const sorted = sortTasks([
      task('Undated', null),
      task('Next week', '2026-12-05'),
      task('Overdue', '2026-11-20'),
      task('Today', '2026-11-28'),
      task('Way overdue', '2026-10-01'),
    ])
    expect(sorted.map(t => t.title)).toEqual(['Way overdue', 'Overdue', 'Today', 'Next week', 'Undated'])
  })

  it('breaks ties by title, then by creation time; does not mutate the input', () => {
    const input = [
      task('b', '2026-12-01', '2026-11-02T00:00:00Z'),
      task('a', '2026-12-01'),
      task('b', '2026-12-01', '2026-11-01T00:00:00Z'),
      task('z', null),
      task('c', null),
    ]
    const sorted = sortTasks(input)
    expect(sorted.map(t => `${t.title}${t.createdAt.slice(9, 10)}`)).toEqual(['a1', 'b1', 'b2', 'c1', 'z1'])
    expect(input[0]?.title).toBe('b')
  })
})

describe('describeSchedule', () => {
  it.each([
    ['2026-11-28', 'week', 1, 'Due today, then every week after each completion.'],
    ['2026-11-29', 'week', 2, 'Due tomorrow, then every 2 weeks after each completion.'],
    ['2026-12-06', 'month', 3, 'Due Sun, Dec 6, then every 3 months after each completion.'],
    ['2027-10-15', 'year', 1, 'Due Fri, Oct 15, 2027, then every year after each completion.'],
    ['2026-11-20', 'day', 1, 'Overdue since Fri, Nov 20, then every day after each completion.'],
  ] as const)('%s, %s ×%i', (due, unit, interval, text) => {
    expect(describeSchedule(due, unit, interval, TODAY)).toBe(text)
  })

  it('is null until the values are valid', () => {
    expect(describeSchedule('', 'week', 1, TODAY)).toBeNull()
    expect(describeSchedule('2026-02-30', 'week', 1, TODAY)).toBeNull()
    expect(describeSchedule('2026-12-01', 'week', 0, TODAY)).toBeNull()
    expect(describeSchedule('2026-12-01', 'week', Number.NaN, TODAY)).toBeNull()
  })
})

describe('doneLabel', () => {
  it('shows the completion day in the household timezone', () => {
    expect(doneLabel('2026-11-28T08:00:00Z', 'UTC', TODAY)).toBe('Done today')
    expect(doneLabel('2026-11-27T08:00:00Z', 'UTC', TODAY)).toBe('Done yesterday')
    expect(doneLabel('2026-11-20T08:00:00Z', 'UTC', TODAY)).toBe('Done Nov 20')
    expect(doneLabel('2025-12-31T08:00:00Z', 'UTC', TODAY)).toBe('Done Dec 31, 2025')
    // 23:30 UTC on Nov 27 is already Nov 28 in Jerusalem.
    expect(doneLabel('2026-11-27T23:30:00Z', 'Asia/Jerusalem', TODAY)).toBe('Done today')
  })
})
