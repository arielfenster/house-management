// docs/04-AUTHORIZATION.md test list: 2 (private/shared), 3 (only creator changes visibility),
// 6 (no spoofed created_by / foreign household_id) for `notes`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminClient, anonClient, cleanup, createUser, createWorld, type TestUser, type World } from '../helpers'

let w: World

async function addNote(user: TestUser, household: string, visibility: 'private' | 'shared', title = visibility) {
  const { data, error } = await user.client.from('notes').insert({ household_id: household, visibility, title }).select('id').single()
  if (error) {
    throw new Error(`addNote failed: ${error.message}`)
  }
  return data.id
}

beforeAll(async () => {
  w = await createWorld()
})
afterAll(cleanup)

describe('private vs shared visibility', () => {
  it("A1's private note is invisible to A2 and B1", async () => {
    const id = await addNote(w.a1, w.householdA, 'private')
    expect((await w.a1.client.from('notes').select('id').eq('id', id)).data).toHaveLength(1)
    expect((await w.a2.client.from('notes').select('id').eq('id', id)).data).toEqual([])
    expect((await w.b1.client.from('notes').select('id').eq('id', id)).data).toEqual([])
  })

  it("A2 cannot edit or delete A1's private note", async () => {
    const id = await addNote(w.a1, w.householdA, 'private')
    expect((await w.a2.client.from('notes').update({ content: 'x' }).eq('id', id).select()).data).toEqual([])
    expect((await w.a2.client.from('notes').delete().eq('id', id).select()).data).toEqual([])
    expect((await adminClient().from('notes').select('content').eq('id', id).single()).data?.content).toBe('')
  })

  it("A1's shared note is visible and editable by A2, invisible to B1", async () => {
    const id = await addNote(w.a1, w.householdA, 'shared')
    expect((await w.a2.client.from('notes').select('id').eq('id', id)).data).toHaveLength(1)
    const edited = await w.a2.client.from('notes').update({ content: 'edited by A2' }).eq('id', id).select('content')
    expect(edited.data).toEqual([{ content: 'edited by A2' }])
    expect((await w.b1.client.from('notes').select('id').eq('id', id)).data).toEqual([])
    expect((await w.b1.client.from('notes').update({ content: 'x' }).eq('id', id).select()).data).toEqual([])
  })

  it('any member can delete a shared note', async () => {
    const id = await addNote(w.a1, w.householdA, 'shared')
    expect((await w.a2.client.from('notes').delete().eq('id', id).select()).data).toHaveLength(1)
  })

  it('notes default to private', async () => {
    const { data } = await w.a1.client.from('notes').insert({ household_id: w.householdA }).select('visibility').single()
    expect(data?.visibility).toBe('private')
  })
})

describe('changing visibility', () => {
  it('A2 cannot change the visibility of A1 shared note', async () => {
    const id = await addNote(w.a1, w.householdA, 'shared')
    const { error } = await w.a2.client.from('notes').update({ visibility: 'private' }).eq('id', id)
    expect(error?.message).toBe('only_creator_can_change_visibility')
    expect((await adminClient().from('notes').select('visibility').eq('id', id).single()).data?.visibility).toBe('shared')
  })

  it('the creator can share and unshare', async () => {
    const id = await addNote(w.a1, w.householdA, 'private')
    expect((await w.a1.client.from('notes').update({ visibility: 'shared' }).eq('id', id).select('visibility')).data).toEqual([{ visibility: 'shared' }])
    expect((await w.a2.client.from('notes').select('id').eq('id', id)).data).toHaveLength(1)
    expect((await w.a1.client.from('notes').update({ visibility: 'private' }).eq('id', id).select('visibility')).data).toEqual([{ visibility: 'private' }])
    expect((await w.a2.client.from('notes').select('id').eq('id', id)).data).toEqual([])
  })

  it('rejects unknown visibility values', async () => {
    const { error } = await w.a1.client.from('notes').insert({ household_id: w.householdA, visibility: 'public' })
    expect(error).not.toBeNull()
  })
})

describe('insert and immutability rules', () => {
  it('cannot insert with another user as created_by', async () => {
    const { error } = await w.a2.client.from('notes').insert({ household_id: w.householdA, created_by: w.a1.id })
    expect(error?.code).toBe('42501')
  })

  it("cannot insert into a household you don't belong to", async () => {
    expect((await w.a2.client.from('notes').insert({ household_id: w.householdB })).error?.code).toBe('42501')
    expect((await w.b1.client.from('notes').insert({ household_id: w.householdA, visibility: 'shared' })).error?.code).toBe('42501')
  })

  it('household_id and created_by cannot be changed after insert', async () => {
    const id = await addNote(w.a1, w.householdA, 'shared')
    expect((await w.a1.client.from('notes').update({ household_id: w.householdB }).eq('id', id)).error?.code).toBe('42501')
    expect((await w.a1.client.from('notes').update({ created_by: w.a2.id }).eq('id', id)).error?.code).toBe('42501')
  })

  it('updated_at advances on update', async () => {
    const { data } = await w.a1.client.from('notes').insert({ household_id: w.householdA }).select('id, updated_at').single()
    const updated = await w.a1.client.from('notes').update({ title: 'new' }).eq('id', data!.id).select('updated_at').single()
    expect(new Date(updated.data!.updated_at).getTime()).toBeGreaterThan(new Date(data!.updated_at).getTime())
  })

  it('anonymous users cannot read or write notes', async () => {
    const anon = anonClient()
    expect((await anon.from('notes').select('id')).error).not.toBeNull()
    expect((await anon.from('notes').insert({ household_id: w.householdA })).error).not.toBeNull()
  })
})

describe('leaving a household', () => {
  it('a user who leaves loses access to shared and their own private notes there', async () => {
    const leaver = await createUser('leaver')
    await leaver.client.rpc('join_household', { p_invite_code: w.codeA })
    const priv = await addNote(leaver, w.householdA, 'private')
    const shared = await addNote(w.a1, w.householdA, 'shared')
    expect((await leaver.client.from('notes').select('id').in('id', [priv, shared])).data).toHaveLength(2)

    await leaver.client.from('household_members').delete().eq('user_id', leaver.id)
    expect((await leaver.client.from('notes').select('id').in('id', [priv, shared])).data).toEqual([])
  })
})
