// SHOP-002: RLS and integrity for shopping_lists, shopping_sections, shopping_items.
// docs/04-AUTHORIZATION.md: shopping is household-shared (any member, all operations on sections/items; lists are
// created by create_household and can only be renamed). Test list: 1 (isolation), 6 (spoofed household_id).
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminClient, anonClient, cleanup, createWorld, type TestUser, type World } from '../helpers'

let w: World
let listA: string
let listB: string

async function listOf(householdId: string): Promise<string> {
  const { data, error } = await adminClient().from('shopping_lists').select('id').eq('household_id', householdId).single()
  if (error) {
    throw new Error(`listOf failed: ${error.message}`)
  }
  return data.id
}

async function addSection(user: TestUser, householdId: string, listId: string, name = 'Produce'): Promise<string> {
  const { data, error } = await user.client
    .from('shopping_sections')
    .insert({ list_id: listId, household_id: householdId, name, position: 1 })
    .select('id')
    .single()
  if (error) {
    throw new Error(`addSection failed: ${error.message}`)
  }
  return data.id
}

async function addItem(
  user: TestUser,
  householdId: string,
  listId: string,
  sectionId: string | null = null,
  name = 'Milk',
): Promise<string> {
  const { data, error } = await user.client
    .from('shopping_items')
    .insert({ list_id: listId, household_id: householdId, section_id: sectionId, name, position: 1 })
    .select('id')
    .single()
  if (error) {
    throw new Error(`addItem failed: ${error.message}`)
  }
  return data.id
}

beforeAll(async () => {
  w = await createWorld()
  listA = await listOf(w.householdA)
  listB = await listOf(w.householdB)
})
afterAll(cleanup)

describe('list creation', () => {
  it('create_household creates exactly one list, visible to both members', async () => {
    const { data } = await adminClient().from('shopping_lists').select('id, name').eq('household_id', w.householdA)
    expect(data).toEqual([{ id: listA, name: 'Shopping' }])
    expect((await w.a2.client.from('shopping_lists').select('id')).data).toEqual([{ id: listA }])
  })

  it('members cannot create or delete lists, only rename them', async () => {
    expect((await w.a1.client.from('shopping_lists').insert({ household_id: w.householdA })).error?.code).toBe('42501')
    expect((await w.a1.client.from('shopping_lists').delete().eq('id', listA)).error?.code).toBe('42501')
    const renamed = await w.a2.client.from('shopping_lists').update({ name: 'Groceries' }).eq('id', listA).select('name')
    expect(renamed.data).toEqual([{ name: 'Groceries' }])
  })
})

describe('members share everything', () => {
  it("A2 reads, edits, checks, moves and deletes A1's sections and items", async () => {
    const produce = await addSection(w.a1, w.householdA, listA, 'Produce')
    const dairy = await addSection(w.a1, w.householdA, listA, 'Dairy')
    const item = await addItem(w.a1, w.householdA, listA, produce, 'מלפפונים')

    expect((await w.a2.client.from('shopping_items').select('name').eq('id', item)).data).toEqual([{ name: 'מלפפונים' }])
    const edited = await w.a2.client
      .from('shopping_items')
      .update({ name: 'Cucumbers', checked: true, section_id: dairy, position: 2.5 })
      .eq('id', item)
      .select('name, checked, section_id, position')
    expect(edited.data).toEqual([{ name: 'Cucumbers', checked: true, section_id: dairy, position: 2.5 }])
    expect((await w.a2.client.from('shopping_sections').update({ name: 'Fruit & veg' }).eq('id', produce).select()).data).toHaveLength(1)
    expect((await w.a2.client.from('shopping_items').delete().eq('id', item).select()).data).toHaveLength(1)
    expect((await w.a2.client.from('shopping_sections').delete().eq('id', produce).select()).data).toHaveLength(1)
  })

  it('a client-chosen id is kept (optimistic rows)', async () => {
    const id = randomUUID()
    const { data } = await w.a1.client
      .from('shopping_items')
      .insert({ id, list_id: listA, household_id: w.householdA, name: 'Eggs', position: 1 })
      .select('id')
      .single()
    expect(data?.id).toBe(id)
  })

  it('deleting a section keeps its items: they move to the end of the top area, in order (D24)', async () => {
    const section = await addSection(w.a1, w.householdA, listA, 'Bakery')
    const pitas = await addItem(w.a1, w.householdA, listA, section, 'Pitas')
    const bread = await addItem(w.a1, w.householdA, listA, section, 'Bread')
    await w.a1.client.from('shopping_items').update({ position: 0.5 }).eq('id', bread)
    const loose = await addItem(w.a1, w.householdA, listA, null, 'Batteries')
    await w.a1.client.from('shopping_items').update({ position: 7 }).eq('id', loose)

    // Deleted by the other member (RLS applies to the trigger's updates too).
    expect((await w.a2.client.from('shopping_sections').delete().eq('id', section).select()).data).toHaveLength(1)
    const { data } = await adminClient()
      .from('shopping_items')
      .select('id, section_id, position')
      .in('id', [pitas, bread, loose])
      .order('position')
    expect(data).toEqual([
      { id: loose, section_id: null, position: 7 },
      { id: bread, section_id: null, position: 8 },
      { id: pitas, section_id: null, position: 9 },
    ])
  })
})

describe('1. household isolation (B1 vs household A)', () => {
  it("B1 cannot read A's list, sections or items", async () => {
    const section = await addSection(w.a1, w.householdA, listA)
    const item = await addItem(w.a1, w.householdA, listA, section)
    expect((await w.b1.client.from('shopping_lists').select('id').eq('id', listA)).data).toEqual([])
    expect((await w.b1.client.from('shopping_sections').select('id').eq('id', section)).data).toEqual([])
    expect((await w.b1.client.from('shopping_items').select('id').eq('id', item)).data).toEqual([])
  })

  it("B1 cannot change or delete A's list, sections or items", async () => {
    const section = await addSection(w.a1, w.householdA, listA, 'Meat')
    const item = await addItem(w.a1, w.householdA, listA, section, 'Chicken')

    expect((await w.b1.client.from('shopping_lists').update({ name: 'pwned' }).eq('id', listA).select()).data).toEqual([])
    expect((await w.b1.client.from('shopping_sections').update({ name: 'pwned' }).eq('id', section).select()).data).toEqual([])
    expect((await w.b1.client.from('shopping_items').update({ checked: true }).eq('id', item).select()).data).toEqual([])
    expect((await w.b1.client.from('shopping_items').delete().eq('id', item).select()).data).toEqual([])
    expect((await w.b1.client.from('shopping_sections').delete().eq('id', section).select()).data).toEqual([])

    const admin = adminClient()
    expect((await admin.from('shopping_sections').select('name').eq('id', section).single()).data?.name).toBe('Meat')
    expect((await admin.from('shopping_items').select('checked').eq('id', item).single()).data?.checked).toBe(false)
  })

  it('B1 cannot insert into household A', async () => {
    const section = await addSection(w.a1, w.householdA, listA)
    const sectionInsert = await w.b1.client
      .from('shopping_sections')
      .insert({ list_id: listA, household_id: w.householdA, name: 'x', position: 1 })
    expect(sectionInsert.error?.code).toBe('42501')
    const itemInsert = await w.b1.client
      .from('shopping_items')
      .insert({ list_id: listA, household_id: w.householdA, section_id: section, name: 'x', position: 1 })
    expect(itemInsert.error?.code).toBe('42501')
  })

  it('anonymous users have no access', async () => {
    const anon = anonClient()
    for (const table of ['shopping_lists', 'shopping_sections', 'shopping_items'] as const) {
      expect((await anon.from(table).select('id')).error, table).not.toBeNull()
    }
  })
})

describe('6. spoofed household_id / list_id', () => {
  it("B1 cannot attach rows to A's list by claiming their own household", async () => {
    const section = await w.b1.client
      .from('shopping_sections')
      .insert({ list_id: listA, household_id: w.householdB, name: 'x', position: 1 })
    expect(section.error?.code).toBe('23503')
    const item = await w.b1.client
      .from('shopping_items')
      .insert({ list_id: listA, household_id: w.householdB, name: 'x', position: 1 })
    expect(item.error?.code).toBe('23503')
  })

  it("A1 cannot put an item into B's section", async () => {
    const sectionB = await addSection(w.b1, w.householdB, listB, 'B only')
    const insert = await w.a1.client
      .from('shopping_items')
      .insert({ list_id: listA, household_id: w.householdA, section_id: sectionB, name: 'x', position: 1 })
    expect(insert.error?.code).toBe('23503')

    const item = await addItem(w.a1, w.householdA, listA)
    const move = await w.a1.client.from('shopping_items').update({ section_id: sectionB }).eq('id', item)
    expect(move.error?.code).toBe('23503')
  })

  it('household_id and list_id cannot be changed', async () => {
    const section = await addSection(w.a1, w.householdA, listA)
    const item = await addItem(w.a1, w.householdA, listA)
    expect((await w.a1.client.from('shopping_items').update({ household_id: w.householdB }).eq('id', item)).error?.code).toBe('42501')
    expect((await w.a1.client.from('shopping_items').update({ list_id: listB }).eq('id', item)).error?.code).toBe('42501')
    expect((await w.a1.client.from('shopping_sections').update({ household_id: w.householdB }).eq('id', section)).error?.code).toBe('42501')
    expect((await w.a1.client.from('shopping_lists').update({ household_id: w.householdB }).eq('id', listA)).error?.code).toBe('42501')
  })

  it('names must be non-blank', async () => {
    const blank = await w.a1.client
      .from('shopping_items')
      .insert({ list_id: listA, household_id: w.householdA, name: '   ', position: 1 })
    expect(blank.error?.code).toBe('23514')
  })
})
