// docs/04-AUTHORIZATION.md test list: 1 (B1 cannot read/write any A resource) for the
// Phase 0 tables, plus profile rules. Task tables: rls/tasks.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminClient, anonClient, cleanup, createWorld, type World } from '../helpers'

let w: World
let noteA: string
beforeAll(async () => {
  w = await createWorld()
  const { data } = await w.a1.client.from('notes')
    .insert({ household_id: w.householdA, title: 'shared A', visibility: 'shared' }).select('id').single()
  noteA = data!.id
})
afterAll(cleanup)

describe('household isolation: B1 vs household A', () => {
  it('B1 sees only their own household and membership', async () => {
    const households = await w.b1.client.from('households').select('id')
    expect(households.data).toEqual([{ id: w.householdB }])
    const members = await w.b1.client.from('household_members').select('household_id')
    expect(members.data).toEqual([{ household_id: w.householdB }])
  })

  it("B1 cannot read A's households, memberships, profiles or notes", async () => {
    expect((await w.b1.client.from('households').select('id').eq('id', w.householdA)).data).toEqual([])
    expect((await w.b1.client.from('household_members').select('user_id').eq('household_id', w.householdA)).data).toEqual([])
    expect((await w.b1.client.from('profiles').select('id').in('id', [w.a1.id, w.a2.id])).data).toEqual([])
    expect((await w.b1.client.from('notes').select('id').eq('id', noteA)).data).toEqual([])
  })

  it("B1 cannot modify A's household, memberships, profiles or notes", async () => {
    const admin = adminClient()
    expect((await w.b1.client.from('households').update({ name: 'pwned' }).eq('id', w.householdA).select()).data).toEqual([])
    expect((await w.b1.client.from('household_members').delete().eq('household_id', w.householdA).select()).data).toEqual([])
    expect((await w.b1.client.from('profiles').update({ display_name: 'pwned' }).eq('id', w.a1.id).select()).data).toEqual([])
    expect((await w.b1.client.from('notes').update({ title: 'pwned' }).eq('id', noteA).select()).data).toEqual([])
    expect((await w.b1.client.from('notes').delete().eq('id', noteA).select()).data).toEqual([])

    // stored state is unchanged
    expect((await admin.from('households').select('name').eq('id', w.householdA).single()).data?.name).toBe('Household A')
    expect((await admin.from('household_members').select('user_id').eq('household_id', w.householdA)).data).toHaveLength(2)
    expect((await admin.from('profiles').select('display_name').eq('id', w.a1.id).single()).data?.display_name).toBe('a1')
    expect((await admin.from('notes').select('title').eq('id', noteA).single()).data?.title).toBe('shared A')
  })

  it("B1 cannot insert into A's household", async () => {
    const note = await w.b1.client.from('notes').insert({ household_id: w.householdA, visibility: 'shared' })
    expect(note.error?.code).toBe('42501')
    const member = await w.b1.client.from('household_members').insert({ household_id: w.householdA, user_id: w.b1.id })
    expect(member.error?.code).toBe('42501')
  })
})

describe('anonymous access', () => {
  it('has no access to any table', async () => {
    const anon = anonClient()
    for (const table of ['profiles', 'households', 'household_members', 'notes'] as const) {
      const { error } = await anon.from(table).select('*')
      expect(error, table).not.toBeNull()
    }
  })
})

describe('profiles', () => {
  it('co-members can see each other; a user can edit only their own profile', async () => {
    const seen = await w.a2.client.from('profiles').select('id, display_name').in('id', [w.a1.id, w.a2.id])
    expect(seen.data).toHaveLength(2)

    const own = await w.a1.client.from('profiles').update({ display_name: 'Ann' }).eq('id', w.a1.id).select('display_name')
    expect(own.data).toEqual([{ display_name: 'Ann' }])
    const other = await w.a1.client.from('profiles').update({ display_name: 'pwned' }).eq('id', w.a2.id).select()
    expect(other.data).toEqual([])
  })

  it('rejects out-of-range notification settings', async () => {
    const { error } = await w.a1.client.from('profiles').update({ reminder_hour: 99 }).eq('id', w.a1.id)
    expect(error?.code).toBe('23514')
  })

  it('creates a profile on signup from metadata, falling back to the email prefix', async () => {
    const admin = adminClient()
    const { data } = await admin.from('profiles').select('display_name').eq('id', w.a1.id).single()
    expect(data).not.toBeNull()
    const created = await admin.auth.admin.createUser({ email: `fallback-${Date.now()}@rls-test.example.com`, password: `pw-${Date.now()}-x`, email_confirm: true })
    const profile = await admin.from('profiles').select('display_name').eq('id', created.data.user!.id).single()
    expect(profile.data?.display_name).toMatch(/^fallback-\d+$/)
    await admin.auth.admin.deleteUser(created.data.user!.id)
  })
})
