// TASKS-003: RLS for tasks, task_completions, task_categories, rooms.
// docs/04-AUTHORIZATION.md test list: 1 (isolation), 2 (private/shared), 3 (visibility change), 4 (assignment
// does not grant access; private tasks not assignable to others), 5 (non-member assignee), 6 (spoofed
// created_by / household_id), 10 (completion RPC refuses invisible tasks).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminClient, anonClient, cleanup, createTask, createUser, createWorld, isoDate, type World } from '../helpers'

let w: World

beforeAll(async () => {
  w = await createWorld()
})
afterAll(cleanup)

async function visibleTo(client: World['a1']['client'], id: string): Promise<boolean> {
  const { data } = await client.from('tasks').select('id').eq('id', id)
  return (data ?? []).length === 1
}

describe('1. household isolation (B1 vs household A)', () => {
  it("B1 cannot read A's tasks, completions, categories or rooms", async () => {
    const id = await createTask(w.a1, w.householdA)
    await w.a1.client.rpc('complete_task', { p_task_id: id })
    expect(await visibleTo(w.b1.client, id)).toBe(false)
    expect((await w.b1.client.from('task_completions').select('id').eq('task_id', id)).data).toEqual([])
    expect((await w.b1.client.from('task_categories').select('id').eq('household_id', w.householdA)).data).toEqual([])
    expect((await w.b1.client.from('rooms').select('id').eq('household_id', w.householdA)).data).toEqual([])
  })

  it("B1 cannot change or delete A's tasks, categories or rooms", async () => {
    const id = await createTask(w.a1, w.householdA, { title: 'Clean AC filters' })
    const { data: cat } = await adminClient().from('task_categories').select('id, name').eq('household_id', w.householdA).limit(1).single()
    const { data: room } = await adminClient().from('rooms').select('id, name').eq('household_id', w.householdA).limit(1).single()

    expect((await w.b1.client.from('tasks').update({ title: 'pwned' }).eq('id', id).select()).data).toEqual([])
    expect((await w.b1.client.from('tasks').delete().eq('id', id).select()).data).toEqual([])
    expect((await w.b1.client.from('task_categories').update({ name: 'pwned' }).eq('id', cat!.id).select()).data).toEqual([])
    expect((await w.b1.client.from('task_categories').delete().eq('id', cat!.id).select()).data).toEqual([])
    expect((await w.b1.client.from('rooms').update({ name: 'pwned' }).eq('id', room!.id).select()).data).toEqual([])
    expect((await w.b1.client.from('rooms').delete().eq('id', room!.id).select()).data).toEqual([])

    const admin = adminClient()
    expect((await admin.from('tasks').select('title').eq('id', id).single()).data?.title).toBe('Clean AC filters')
    expect((await admin.from('task_categories').select('name').eq('id', cat!.id).single()).data?.name).toBe(cat!.name)
    expect((await admin.from('rooms').select('name').eq('id', room!.id).single()).data?.name).toBe(room!.name)
  })

  it("B1 cannot insert tasks, categories or rooms into household A", async () => {
    expect((await w.b1.client.from('tasks').insert({ household_id: w.householdA, title: 'x', kind: 'one_time' })).error?.code).toBe('42501')
    expect((await w.b1.client.from('task_categories').insert({ household_id: w.householdA, name: 'x' })).error?.code).toBe('42501')
    expect((await w.b1.client.from('rooms').insert({ household_id: w.householdA, name: 'x' })).error?.code).toBe('42501')
  })

  it('anonymous users have no access', async () => {
    const anon = anonClient()
    for (const table of ['tasks', 'task_completions', 'task_categories', 'rooms'] as const) {
      expect((await anon.from(table).select('id')).error, table).not.toBeNull()
    }
    const id = await createTask(w.a1, w.householdA)
    expect((await anon.rpc('complete_task', { p_task_id: id })).error).not.toBeNull()
    expect((await anon.rpc('uncomplete_task', { p_task_id: id })).error).not.toBeNull()
  })
})

describe('2. private vs shared tasks', () => {
  it('tasks are shared by default: A2 sees and edits A1\'s task', async () => {
    const id = await createTask(w.a1, w.householdA)
    expect(await visibleTo(w.a2.client, id)).toBe(true)
    const edited = await w.a2.client.from('tasks').update({ title: 'Fix bathroom faucet' }).eq('id', id).select('title, visibility')
    expect(edited.data).toEqual([{ title: 'Fix bathroom faucet', visibility: 'shared' }])
    expect((await w.a2.client.from('tasks').delete().eq('id', id).select()).data).toHaveLength(1)
  })

  it("A1's private task (and its history) is invisible and untouchable for A2", async () => {
    const id = await createTask(w.a1, w.householdA, { visibility: 'private' })
    await w.a1.client.rpc('complete_task', { p_task_id: id })
    expect(await visibleTo(w.a1.client, id)).toBe(true)
    expect(await visibleTo(w.a2.client, id)).toBe(false)
    expect((await w.a1.client.from('task_completions').select('id').eq('task_id', id)).data).toHaveLength(1)
    expect((await w.a2.client.from('task_completions').select('id').eq('task_id', id)).data).toEqual([])
    expect((await w.a2.client.from('tasks').update({ title: 'x' }).eq('id', id).select()).data).toEqual([])
    expect((await w.a2.client.from('tasks').delete().eq('id', id).select()).data).toEqual([])
  })
})

describe('3. changing visibility', () => {
  it("A2 cannot change the visibility of A1's shared task", async () => {
    const id = await createTask(w.a1, w.householdA)
    const { error } = await w.a2.client.from('tasks').update({ visibility: 'private' }).eq('id', id)
    expect(error?.message).toBe('only_creator_can_change_visibility')
    expect((await adminClient().from('tasks').select('visibility').eq('id', id).single()).data?.visibility).toBe('shared')
  })

  it('the creator can make a task private and shared again', async () => {
    const id = await createTask(w.a1, w.householdA)
    await w.a1.client.from('tasks').update({ visibility: 'private' }).eq('id', id)
    expect(await visibleTo(w.a2.client, id)).toBe(false)
    await w.a1.client.from('tasks').update({ visibility: 'shared' }).eq('id', id)
    expect(await visibleTo(w.a2.client, id)).toBe(true)
  })
})

describe('4–5. assignment', () => {
  it('assigning a shared task to A2 keeps it visible to A1', async () => {
    const id = await createTask(w.a1, w.householdA, { assigned_to: w.a2.id })
    expect(await visibleTo(w.a1.client, id)).toBe(true)
    expect(await visibleTo(w.a2.client, id)).toBe(true)
  })

  it('a private task can be self-assigned but not assigned to someone else', async () => {
    expect((await w.a1.client.from('tasks').insert({ household_id: w.householdA, title: 'x', kind: 'one_time', visibility: 'private', assigned_to: w.a1.id })).error).toBeNull()
    const other = await w.a1.client.from('tasks').insert({ household_id: w.householdA, title: 'x', kind: 'one_time', visibility: 'private', assigned_to: w.a2.id })
    expect(other.error?.code).toBe('23514')

    const id = await createTask(w.a1, w.householdA, { visibility: 'private' })
    expect((await w.a1.client.from('tasks').update({ assigned_to: w.a2.id }).eq('id', id)).error?.code).toBe('23514')
    // ...and a task assigned to A2 cannot be made private.
    const shared = await createTask(w.a1, w.householdA, { assigned_to: w.a2.id })
    expect((await w.a1.client.from('tasks').update({ visibility: 'private' }).eq('id', shared)).error?.code).toBe('23514')
  })

  it('assigning to a non-member (B1) is rejected', async () => {
    const insert = await w.a1.client.from('tasks').insert({ household_id: w.householdA, title: 'x', kind: 'one_time', assigned_to: w.b1.id })
    expect(insert.error?.message).toBe('assignee_not_member')
    const id = await createTask(w.a1, w.householdA)
    expect((await w.a1.client.from('tasks').update({ assigned_to: w.b1.id }).eq('id', id)).error?.message).toBe('assignee_not_member')
  })

  it('a member who leaves is unassigned and loses access', async () => {
    const leaver = await createUser('leaver')
    await leaver.client.rpc('join_household', { p_invite_code: w.codeA })
    const id = await createTask(w.a1, w.householdA, { assigned_to: leaver.id })
    const own = await createTask(leaver, w.householdA, { visibility: 'private' })
    expect(await visibleTo(leaver.client, id)).toBe(true)

    await leaver.client.from('household_members').delete().eq('user_id', leaver.id)
    expect((await adminClient().from('tasks').select('assigned_to').eq('id', id).single()).data?.assigned_to).toBeNull()
    expect(await visibleTo(leaver.client, id)).toBe(false)
    expect(await visibleTo(leaver.client, own)).toBe(false)
  })
})

describe('6. no spoofing, fixed ownership', () => {
  it('cannot insert as another user or into another household', async () => {
    expect((await w.a2.client.from('tasks').insert({ household_id: w.householdA, title: 'x', kind: 'one_time', created_by: w.a1.id })).error?.code).toBe('42501')
    expect((await w.a1.client.from('tasks').insert({ household_id: w.householdB, title: 'x', kind: 'one_time' })).error?.code).toBe('42501')
  })

  it('household_id and created_by cannot be changed', async () => {
    const id = await createTask(w.a1, w.householdA)
    expect((await w.a1.client.from('tasks').update({ household_id: w.householdB }).eq('id', id)).error?.code).toBe('42501')
    expect((await w.a1.client.from('tasks').update({ created_by: w.a2.id }).eq('id', id)).error?.code).toBe('42501')
    expect((await w.a1.client.from('task_categories').update({ household_id: w.householdB }).eq('household_id', w.householdA)).error?.code).toBe('42501')
  })

  it('completions cannot be written directly (RPC only)', async () => {
    const id = await createTask(w.a1, w.householdA)
    const insert = await w.a1.client.from('task_completions').insert({ task_id: id, household_id: w.householdA })
    expect(insert.error?.code).toBe('42501')
    await w.a1.client.rpc('complete_task', { p_task_id: id })
    expect((await w.a1.client.from('task_completions').delete().eq('task_id', id)).error?.code).toBe('42501')
    expect((await w.a1.client.from('task_completions').update({ completed_by: w.a2.id }).eq('task_id', id)).error?.code).toBe('42501')
  })
})

describe('10. completion RPCs refuse tasks the caller cannot see', () => {
  it("B1 cannot complete or uncomplete A's task; A2 cannot touch A1's private task", async () => {
    const shared = await createTask(w.a1, w.householdA, { kind: 'recurring', recurrence_unit: 'week', recurrence_interval: 1, due_date: isoDate() })
    const args = { p_task_id: shared, p_expected_due_date: isoDate(), p_next_due_date: isoDate(7) }
    expect((await w.b1.client.rpc('complete_task', args)).error?.message).toBe('task_not_found')

    const priv = await createTask(w.a1, w.householdA, { visibility: 'private' })
    expect((await w.a2.client.rpc('complete_task', { p_task_id: priv })).error?.message).toBe('task_not_found')

    await w.a1.client.rpc('complete_task', args)
    await w.a1.client.rpc('complete_task', { p_task_id: priv })
    expect((await w.b1.client.rpc('uncomplete_task', { p_task_id: shared })).error?.message).toBe('task_not_found')
    expect((await w.a2.client.rpc('uncomplete_task', { p_task_id: priv })).error?.message).toBe('task_not_found')

    // Nothing changed.
    expect((await adminClient().from('task_completions').select('id').in('task_id', [shared, priv])).data).toHaveLength(2)
  })
})

describe('categories and rooms: any member manages them', () => {
  it('A2 can add, rename and delete; names are unique per household, ignoring case', async () => {
    const { data, error } = await w.a2.client.from('task_categories').insert({ household_id: w.householdA, name: 'Pets' }).select('id').single()
    expect(error).toBeNull()
    expect((await w.a1.client.from('task_categories').insert({ household_id: w.householdA, name: 'pets' })).error?.code).toBe('23505')
    // Another household may use the same name.
    expect((await w.b1.client.from('task_categories').insert({ household_id: w.householdB, name: 'Pets' })).error).toBeNull()
    expect((await w.a1.client.from('task_categories').update({ name: 'Pets & plants' }).eq('id', data!.id).select('name')).data).toEqual([{ name: 'Pets & plants' }])
    expect((await w.a1.client.from('task_categories').delete().eq('id', data!.id).select()).data).toHaveLength(1)

    const room = await w.a2.client.from('rooms').insert({ household_id: w.householdA, name: 'Laundry' }).select('id').single()
    expect(room.error).toBeNull()
    expect((await w.a1.client.from('rooms').insert({ household_id: w.householdA, name: 'LAUNDRY' })).error?.code).toBe('23505')
    expect((await w.a1.client.from('rooms').delete().eq('id', room.data!.id).select()).data).toHaveLength(1)
  })

  it('rejects blank and overlong names', async () => {
    expect((await w.a1.client.from('rooms').insert({ household_id: w.householdA, name: '  ' })).error?.code).toBe('23514')
    expect((await w.a1.client.from('rooms').insert({ household_id: w.householdA, name: 'x'.repeat(51) })).error?.code).toBe('23514')
  })
})
