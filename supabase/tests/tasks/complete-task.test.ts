// TASKS-002: complete_task / uncomplete_task RPCs and the tasks table constraints.
// Authorization (who may call them on which task) is covered in rls/tasks.test.ts (TASKS-003).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminClient, cleanup, createTask, createWorld, isoDate, type World } from '../helpers'

let w: World

beforeAll(async () => {
  w = await createWorld()
})
afterAll(cleanup)

async function taskRow(id: string) {
  const { data } = await adminClient()
    .from('tasks')
    .select('due_date, completed_at, last_completed_at')
    .eq('id', id)
    .single()
  return data!
}

async function completions(id: string) {
  const { data } = await adminClient()
    .from('task_completions')
    .select('id, completed_by, due_date_at_completion, household_id')
    .eq('task_id', id)
    .order('completed_at')
  return data!
}

function recurring(dueInDays: number) {
  return {
    kind: 'recurring',
    recurrence_unit: 'month',
    recurrence_interval: 3,
    due_date: isoDate(dueInDays),
  }
}

describe('one-time tasks', () => {
  it('completing sets completed_at and records who did it', async () => {
    const id = await createTask(w.a1, w.householdA, { due_date: isoDate(2) })
    const { data, error } = await w.a2.client.rpc('complete_task', { p_task_id: id }).single()
    expect(error).toBeNull()
    expect(data?.completed_at).not.toBeNull()
    expect((await taskRow(id)).completed_at).not.toBeNull()
    const history = await completions(id)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ completed_by: w.a2.id, due_date_at_completion: isoDate(2), household_id: w.householdA })
  })

  it('cannot be completed twice', async () => {
    const id = await createTask(w.a1, w.householdA)
    await w.a1.client.rpc('complete_task', { p_task_id: id })
    const { error } = await w.a2.client.rpc('complete_task', { p_task_id: id })
    expect(error?.message).toBe('already_completed')
    expect(await completions(id)).toHaveLength(1)
  })

  it('uncomplete reopens it and removes the history row', async () => {
    const id = await createTask(w.a1, w.householdA)
    await w.a1.client.rpc('complete_task', { p_task_id: id })
    const { data, error } = await w.a1.client.rpc('uncomplete_task', { p_task_id: id }).single()
    expect(error).toBeNull()
    expect(data?.completed_at).toBeNull()
    expect(await completions(id)).toEqual([])
    expect((await w.a1.client.rpc('uncomplete_task', { p_task_id: id })).error?.message).toBe('not_completed')
  })
})

describe('recurring tasks', () => {
  it('completing advances due_date, sets last_completed_at and keeps history', async () => {
    const id = await createTask(w.a1, w.householdA, recurring(-5))
    const next = isoDate(85)
    const { data, error } = await w.a1.client
      .rpc('complete_task', { p_task_id: id, p_expected_due_date: isoDate(-5), p_next_due_date: next })
      .single()
    expect(error).toBeNull()
    expect(data).toMatchObject({ due_date: next, completed_at: null })
    const row = await taskRow(id)
    expect(row.due_date).toBe(next)
    expect(row.completed_at).toBeNull()
    expect(row.last_completed_at).not.toBeNull()
    expect((await completions(id))[0]?.due_date_at_completion).toBe(isoDate(-5))
  })

  it('a second completion of the same occurrence is rejected (stale due date)', async () => {
    const id = await createTask(w.a1, w.householdA, recurring(0))
    const args = { p_task_id: id, p_expected_due_date: isoDate(0), p_next_due_date: isoDate(90) }
    expect((await w.a1.client.rpc('complete_task', args)).error).toBeNull()
    expect((await w.a2.client.rpc('complete_task', args)).error?.message).toBe('stale_due_date')
    expect(await completions(id)).toHaveLength(1)
  })

  it('requires a next due date after today', async () => {
    const id = await createTask(w.a1, w.householdA, recurring(0))
    for (const next of [undefined, isoDate(0), isoDate(-1)]) {
      const { error } = await w.a1.client.rpc('complete_task', { p_task_id: id, p_expected_due_date: isoDate(0), p_next_due_date: next })
      expect(error?.message, String(next)).toBe('invalid_next_due_date')
    }
    expect(await completions(id)).toEqual([])
  })

  it('undo restores the previous due date and last completion', async () => {
    const id = await createTask(w.a1, w.householdA, recurring(-3))
    const first = await w.a1.client
      .rpc('complete_task', { p_task_id: id, p_expected_due_date: isoDate(-3), p_next_due_date: isoDate(30) })
      .single()
    const afterFirst = await taskRow(id)
    const second = await w.a2.client
      .rpc('complete_task', { p_task_id: id, p_expected_due_date: isoDate(30), p_next_due_date: isoDate(60) })
      .single()

    // An undo naming the older completion is refused: it would remove A2's later one.
    const stale = await w.a1.client.rpc('uncomplete_task', { p_task_id: id, p_completion_id: first.data!.completion_id })
    expect(stale.error?.message).toBe('not_latest_completion')

    const undo = await w.a2.client.rpc('uncomplete_task', { p_task_id: id, p_completion_id: second.data!.completion_id }).single()
    expect(undo.error).toBeNull()
    expect(await taskRow(id)).toEqual(afterFirst)

    await w.a1.client.rpc('uncomplete_task', { p_task_id: id })
    expect(await taskRow(id)).toMatchObject({ due_date: isoDate(-3), last_completed_at: null })
    expect((await w.a1.client.rpc('uncomplete_task', { p_task_id: id })).error?.message).toBe('no_completion')
  })
})

describe('constraints', () => {
  it('recurring tasks need a unit, an interval and a due date', async () => {
    const insert = (fields: object) =>
      w.a1.client.from('tasks').insert({ household_id: w.householdA, title: 'x', kind: 'recurring', ...fields })
    expect((await insert({ recurrence_unit: 'week', recurrence_interval: 1 })).error?.code).toBe('23514')
    expect((await insert({ recurrence_unit: 'week', due_date: isoDate() })).error?.code).toBe('23514')
    expect((await insert({ recurrence_unit: 'fortnight', recurrence_interval: 1, due_date: isoDate() })).error?.code).toBe('23514')
    expect((await insert({ recurrence_unit: 'week', recurrence_interval: 0, due_date: isoDate() })).error?.code).toBe('23514')
    expect((await insert({ recurrence_unit: 'week', recurrence_interval: 1, due_date: isoDate() })).error).toBeNull()
  })

  it('one-time tasks cannot carry a recurrence; titles cannot be blank', async () => {
    const base = { household_id: w.householdA, kind: 'one_time' }
    expect((await w.a1.client.from('tasks').insert({ ...base, title: 'x', recurrence_unit: 'day', recurrence_interval: 1 })).error?.code).toBe('23514')
    expect((await w.a1.client.from('tasks').insert({ ...base, title: '   ' })).error?.code).toBe('23514')
  })

  it('completion columns are not client-writable', async () => {
    const id = await createTask(w.a1, w.householdA)
    expect((await w.a1.client.from('tasks').update({ completed_at: new Date().toISOString() }).eq('id', id)).error?.code).toBe('42501')
    expect((await w.a1.client.from('tasks').update({ last_completed_at: new Date().toISOString() }).eq('id', id)).error?.code).toBe('42501')
  })

  it('turning a completed one-time task into a recurring one reopens it', async () => {
    const id = await createTask(w.a1, w.householdA, { due_date: isoDate(1) })
    await w.a1.client.rpc('complete_task', { p_task_id: id })
    const { error } = await w.a1.client.from('tasks')
      .update({ kind: 'recurring', recurrence_unit: 'week', recurrence_interval: 1 })
      .eq('id', id)
    expect(error).toBeNull()
    expect((await taskRow(id)).completed_at).toBeNull()
  })

  it("a task cannot use another household's category or room", async () => {
    const { data: catB } = await adminClient().from('task_categories').select('id').eq('household_id', w.householdB).limit(1).single()
    const { data: roomB } = await adminClient().from('rooms').select('id').eq('household_id', w.householdB).limit(1).single()
    expect((await w.a1.client.from('tasks').insert({ household_id: w.householdA, title: 'x', kind: 'one_time', category_id: catB!.id })).error?.code).toBe('23503')
    expect((await w.a1.client.from('tasks').insert({ household_id: w.householdA, title: 'x', kind: 'one_time', room_id: roomB!.id })).error?.code).toBe('23503')
  })

  it('deleting a category or room clears it on tasks; deleting a task removes its history', async () => {
    const { data: cat } = await w.a1.client.from('task_categories').insert({ household_id: w.householdA, name: 'Garden' }).select('id').single()
    const { data: room } = await w.a1.client.from('rooms').insert({ household_id: w.householdA, name: 'Garage' }).select('id').single()
    const id = await createTask(w.a1, w.householdA, { category_id: cat!.id, room_id: room!.id })
    await w.a1.client.from('task_categories').delete().eq('id', cat!.id)
    await w.a1.client.from('rooms').delete().eq('id', room!.id)
    const { data } = await adminClient().from('tasks').select('category_id, room_id').eq('id', id).single()
    expect(data).toEqual({ category_id: null, room_id: null })

    await w.a1.client.rpc('complete_task', { p_task_id: id })
    await w.a1.client.from('tasks').delete().eq('id', id)
    expect(await completions(id)).toEqual([])
  })
})
