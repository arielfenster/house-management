// TASKS-005: server/utils/complete-task.ts (the logic behind POST /api/tasks/[id]/complete), run with real
// JWT-scoped clients: next due date in the household timezone, concurrent-completion guard, error mapping.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { completeTask } from '../../../server/utils/complete-task'
import { addInterval, localToday } from '../../../shared/recurrence'
import { adminClient, cleanup, createHousehold, createTask, createUser, createWorld, isoDate, type TestUser, type World } from '../helpers'

let w: World
// A household far east of UTC: its "today" is often a day ahead of the test runner's.
let east: TestUser
let eastHousehold: string
const EAST_TZ = 'Pacific/Kiritimati'

beforeAll(async () => {
  w = await createWorld()
  east = await createUser('east')
  eastHousehold = await createHousehold(east, 'East home', EAST_TZ)
})
afterAll(cleanup)

describe('completeTask', () => {
  it('recurring: next due = today in the household timezone + interval', async () => {
    const due = localToday(EAST_TZ)
    const id = await createTask(east, eastHousehold, { kind: 'recurring', recurrence_unit: 'month', recurrence_interval: 3, due_date: due })
    const result = await completeTask(east.client, id, due)
    const expected = addInterval(localToday(EAST_TZ), 'month', 3)
    expect(result).toMatchObject({ ok: true, dueDate: expected, completedAt: null })
    expect(result.ok && result.lastCompletedAt).toBeTruthy()
    const { data } = await adminClient().from('tasks').select('due_date').eq('id', id).single()
    expect(data?.due_date).toBe(expected)
  })

  it('recurring, completed late: counts from today, not from the old due date', async () => {
    const id = await createTask(w.a1, w.householdA, { kind: 'recurring', recurrence_unit: 'week', recurrence_interval: 1, due_date: isoDate(-20) })
    const result = await completeTask(w.a2.client, id, isoDate(-20))
    expect(result).toMatchObject({ ok: true, dueDate: addInterval(localToday('UTC'), 'week', 1) })
  })

  it('one-time: completes and reports completedAt', async () => {
    const id = await createTask(w.a1, w.householdA, { due_date: isoDate(3) })
    const result = await completeTask(w.a1.client, id, undefined)
    expect(result).toMatchObject({ ok: true, dueDate: isoDate(3) })
    expect(result.ok && result.completedAt).toBeTruthy()
  })

  it('409 when the due date the user saw is out of date (someone completed it first)', async () => {
    const id = await createTask(w.a1, w.householdA, { kind: 'recurring', recurrence_unit: 'day', recurrence_interval: 2, due_date: isoDate(0) })
    expect((await completeTask(w.a1.client, id, isoDate(0))).ok).toBe(true)
    expect(await completeTask(w.a2.client, id, isoDate(0))).toEqual({ ok: false, status: 409, code: 'stale_due_date' })
  })

  it('409 when a one-time task is already completed', async () => {
    const id = await createTask(w.a1, w.householdA)
    await completeTask(w.a1.client, id, null)
    expect(await completeTask(w.a2.client, id, null)).toEqual({ ok: false, status: 409, code: 'already_completed' })
  })

  it('404 for tasks the caller cannot see (other household, private) or that do not exist', async () => {
    const shared = await createTask(w.a1, w.householdA)
    const priv = await createTask(w.a1, w.householdA, { visibility: 'private' })
    expect(await completeTask(w.b1.client, shared, null)).toEqual({ ok: false, status: 404, code: 'task_not_found' })
    expect(await completeTask(w.a2.client, priv, null)).toEqual({ ok: false, status: 404, code: 'task_not_found' })
    expect(await completeTask(w.a1.client, '00000000-0000-4000-8000-000000000000', null)).toEqual({ ok: false, status: 404, code: 'task_not_found' })
    const { data } = await adminClient().from('tasks').select('completed_at').in('id', [shared, priv])
    expect(data?.every(t => t.completed_at === null)).toBe(true)
  })

  it('undo (uncomplete_task) restores the previous state after a completion', async () => {
    const id = await createTask(w.a1, w.householdA, { kind: 'recurring', recurrence_unit: 'month', recurrence_interval: 1, due_date: isoDate(-2) })
    const result = await completeTask(w.a1.client, id, isoDate(-2))
    expect(result.ok).toBe(true)
    const undo = await w.a1.client.rpc('uncomplete_task', { p_task_id: id, p_completion_id: result.ok ? result.completionId : undefined }).single()
    expect(undo.data).toEqual({ due_date: isoDate(-2), completed_at: null, last_completed_at: null })
  })
})
