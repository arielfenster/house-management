import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { fieldErrors } from './auth'
import { completeTaskBodySchema, quickAddTaskSchema, taskFormSchema, taskFormToColumns, taskListNameSchema, type TaskFormValues } from './task'

const MEMBER = '7d1f3c1e-8a2b-4c3d-9e4f-5a6b7c8d9e0f'

function form(overrides: Partial<TaskFormValues> = {}): TaskFormValues {
  return {
    title: 'Clean AC filters',
    description: '',
    kind: 'one_time',
    dueDate: '',
    recurrenceInterval: '1',
    recurrenceUnit: 'week',
    assignedTo: '',
    categoryId: '',
    roomId: '',
    ...overrides,
  }
}

function errors(values: TaskFormValues) {
  const result = v.safeParse(taskFormSchema, values)
  return result.success ? {} : fieldErrors(result.issues)
}

describe('taskFormSchema', () => {
  it('normalizes a minimal one-time task', () => {
    expect(v.parse(taskFormSchema, form({ title: '  Fix faucet  ' }))).toMatchObject({
      title: 'Fix faucet',
      description: null,
      kind: 'one_time',
      dueDate: null,
      assignedTo: null,
    })
  })

  it('keeps Hebrew text and trims the description', () => {
    const out = v.parse(taskFormSchema, form({ title: 'לקנות מנורה', description: '  לסלון \n' }))
    expect(out.title).toBe('לקנות מנורה')
    expect(out.description).toBe('לסלון')
  })

  it('requires a title within the limit', () => {
    expect(errors(form({ title: '   ' })).title).toBe('Enter a title.')
    expect(errors(form({ title: 'x'.repeat(201) })).title).toMatch(/200/)
  })

  it('validates the due date', () => {
    expect(errors(form({ dueDate: '2026-02-30' })).dueDate).toBe('Enter a valid date.')
    expect(v.parse(taskFormSchema, form({ dueDate: '2026-12-01' })).dueDate).toBe('2026-12-01')
  })

  it('recurring tasks need a whole interval in range and a next due date', () => {
    const recurring = (o: Partial<TaskFormValues>) => form({ kind: 'recurring', dueDate: '2026-12-01', ...o })
    expect(errors(recurring({ recurrenceInterval: '' })).recurrenceInterval).toMatch(/whole number/)
    expect(errors(recurring({ recurrenceInterval: '0' })).recurrenceInterval).toMatch(/whole number/)
    expect(errors(recurring({ recurrenceInterval: '1.5' })).recurrenceInterval).toMatch(/whole number/)
    expect(errors(recurring({ recurrenceInterval: '1000' })).recurrenceInterval).toMatch(/whole number/)
    expect(errors(recurring({ dueDate: '' })).dueDate).toBe('Choose when it is next due.')
    expect(v.parse(taskFormSchema, recurring({ recurrenceInterval: ' 3 ', recurrenceUnit: 'month' }))).toMatchObject({
      kind: 'recurring',
      recurrenceInterval: 3,
      recurrenceUnit: 'month',
      dueDate: '2026-12-01',
    })
  })

  it('one-time tasks ignore the recurrence fields', () => {
    expect(errors(form({ recurrenceInterval: '' }))).toEqual({})
  })

  it('assignee is empty (anyone) or a member id', () => {
    expect(v.parse(taskFormSchema, form({ assignedTo: MEMBER })).assignedTo).toBe(MEMBER)
    expect(errors(form({ assignedTo: 'someone' })).assignedTo).toBe('Choose a member.')
  })
})

describe('taskFormToColumns', () => {
  it('clears recurrence columns for one-time tasks', () => {
    const out = v.parse(taskFormSchema, form({ recurrenceInterval: '3', recurrenceUnit: 'month', dueDate: '2026-12-01' }))
    expect(taskFormToColumns(out)).toEqual({
      title: 'Clean AC filters',
      description: null,
      kind: 'one_time',
      due_date: '2026-12-01',
      recurrence_unit: null,
      recurrence_interval: null,
      assigned_to: null,
      category_id: null,
      room_id: null,
    })
  })

  it('writes recurrence for recurring tasks', () => {
    const out = v.parse(taskFormSchema, form({ kind: 'recurring', recurrenceInterval: '3', recurrenceUnit: 'month', dueDate: '2026-12-01', assignedTo: MEMBER }))
    expect(taskFormToColumns(out)).toMatchObject({ kind: 'recurring', recurrence_unit: 'month', recurrence_interval: 3, assigned_to: MEMBER })
  })
})

describe('other task schemas', () => {
  it('quick add trims and requires a title', () => {
    expect(v.parse(quickAddTaskSchema, { title: '  Water plants ' }).title).toBe('Water plants')
    expect(v.safeParse(quickAddTaskSchema, { title: ' ' }).success).toBe(false)
  })

  it('complete body accepts a date, null or nothing', () => {
    expect(v.safeParse(completeTaskBodySchema, {}).success).toBe(true)
    expect(v.safeParse(completeTaskBodySchema, { expectedDueDate: null }).success).toBe(true)
    expect(v.safeParse(completeTaskBodySchema, { expectedDueDate: '2026-12-01' }).success).toBe(true)
    expect(v.safeParse(completeTaskBodySchema, { expectedDueDate: 'tomorrow' }).success).toBe(false)
  })
})

describe('category / room', () => {
  it('form: empty is None (null), otherwise an id', () => {
    const out = v.parse(taskFormSchema, form({ categoryId: MEMBER, roomId: '' }))
    expect(taskFormToColumns(out)).toMatchObject({ category_id: MEMBER, room_id: null })
    expect(errors(form({ roomId: 'kitchen' })).roomId).toBe('Choose a value from the list.')
  })

  it('names are trimmed, required and at most 50 characters', () => {
    expect(v.parse(taskListNameSchema, '  Garden ')).toBe('Garden')
    expect(v.parse(taskListNameSchema, 'מרפסת')).toBe('מרפסת')
    expect(v.safeParse(taskListNameSchema, '   ').success).toBe(false)
    expect(v.safeParse(taskListNameSchema, 'x'.repeat(51)).success).toBe(false)
  })
})
