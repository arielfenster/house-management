import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useEventListener } from '@vueuse/core'
import { toast } from 'vue-sonner'
import type { Database } from '~~/types/database.types'
import { planMove, positionAtEnd, sortByPosition, type PositionUpdate } from '#shared/shopping-position'

export interface ShoppingSection {
  id: string
  name: string
  position: number
  /** Optimistic row whose insert has not finished yet. */
  pending?: boolean
}

export interface ShoppingItem {
  id: string
  /** null = the top area above the first section. */
  sectionId: string | null
  name: string
  position: number
  /** Optimistic row whose insert has not finished yet. */
  pending?: boolean
}

/** Items of one section (or of the top area, `section` null), in display order. */
export interface ShoppingGroup {
  section: ShoppingSection | null
  items: ShoppingItem[]
}

type ItemRow = Database['public']['Tables']['shopping_items']['Row']
type SectionRow = Database['public']['Tables']['shopping_sections']['Row']

const UNDO_TOAST_MS = 8000
/** Ticked-item toast: one toast (fixed id) replaced by each tick, so fast shopping never stacks toasts. */
const DONE_TOAST_ID = 'shopping-done'
const DONE_TOAST_MS = 5000

interface ShoppingData {
  listId: string | null
  sections: ShoppingSection[]
  items: ShoppingItem[]
}

/**
 * The household's shopping list (features/SHOPPING.md): sections and items in position order, with optimistic
 * check/uncheck. Reads and writes go straight to Supabase under RLS. Checked items stay in place (muted).
 * v1 shows the household's first list (one is created with the household).
 */
export function useShopping() {
  const supabase = useSupabaseClient()
  const { membership } = useMembership()
  const householdId = computed(() => membership.value?.householdId ?? null)

  // Writes in flight, and a counter of writes started. A fetch that overlaps a write may return the state from before
  // it and would undo the optimistic change on screen; such a fetch keeps the current state and runs again once the
  // writes have settled.
  let writesInFlight = 0
  let writesStarted = 0
  let refetchAfterWrites = false

  const { data, pending, error, refresh } = useAsyncData(
    'shopping',
    async (): Promise<ShoppingData> => {
      const startedAt = writesStarted
      if (!householdId.value) {
        return {
          listId: null,
          sections: [],
          items: [],
        }
      }
      const { data: list, error: listError } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('household_id', householdId.value)
        .order('created_at')
        .limit(1)
        .maybeSingle()
      if (listError) {
        throw createError({ statusCode: 500, statusMessage: 'Could not load the shopping list.' })
      }
      if (!list) {
        return {
          listId: null,
          sections: [],
          items: [],
        }
      }
      const [sections, items] = await Promise.all([
        supabase.from('shopping_sections').select('id, name, position').eq('list_id', list.id),
        supabase.from('shopping_items').select('id, section_id, name, position').eq('list_id', list.id),
      ])
      if (sections.error || items.error) {
        throw createError({ statusCode: 500, statusMessage: 'Could not load the shopping list.' })
      }
      if (writesInFlight > 0 || writesStarted !== startedAt) {
        refetchAfterWrites = true
        return data.value
      }
      return {
        listId: list.id,
        sections: sections.data,
        items: items.data.map(row => ({
          id: row.id,
          sectionId: row.section_id,
          name: row.name,
          position: row.position,
        })),
      }
    },
    {
      watch: [householdId],
      default: () => ({
        listId: null,
        sections: [],
        items: [],
      }),
    },
  )

  /** Runs a write, counted for the fetch guard above; refetches afterwards if a fetch was skipped meanwhile. */
  async function tracked<T>(query: PromiseLike<T>): Promise<T> {
    writesInFlight++
    writesStarted++
    try {
      return await query
    } finally {
      writesInFlight--
      if (writesInFlight === 0 && refetchAfterWrites) {
        refetchAfterWrites = false
        void refresh()
      }
    }
  }

  // Added rows waiting for their insert. Kept apart from `data` so a fetch that lands meanwhile cannot drop them;
  // they carry their final id (generated here), so once the fetch has them the copy here is ignored.
  const pendingAdds = ref<ShoppingItem[]>([])

  // Same for sections being created.
  const pendingSections = ref<ShoppingSection[]>([])

  // Deleted sections stay hidden during the undo window and their items show at the end of the top area (D24); the
  // delete runs when the window ends.
  const hiddenSectionIds = ref(new Set<string>())
  const pendingDeletes = new Map<string, ReturnType<typeof setTimeout>>()

  const items = computed((): ShoppingItem[] => {
    const saved = new Set(data.value.items.map(i => i.id))
    return [...data.value.items, ...pendingAdds.value.filter(i => !saved.has(i.id))]
  })

  const sections = computed(() => {
    const saved = new Set(data.value.sections.map(s => s.id))
    return sortByPosition([...data.value.sections, ...pendingSections.value.filter(s => !saved.has(s.id))])
      .filter(s => !hiddenSectionIds.value.has(s.id))
  })

  const groups = computed((): ShoppingGroup[] => {
    const bySection = new Map<string | null, ShoppingItem[]>()
    for (const item of items.value) {
      const key = item.sectionId
      bySection.set(key, [...(bySection.get(key) ?? []), item])
    }
    // Items of sections deleted in the undo window follow the top area's own items, as they will after the delete.
    const released = sortByPosition(data.value.sections.filter(s => hiddenSectionIds.value.has(s.id)))
      .flatMap(s => sortByPosition(bySection.get(s.id) ?? []))
    const top: ShoppingGroup = {
      section: null,
      items: [...sortByPosition(bySection.get(null) ?? []), ...released],
    }
    const rest = sections.value.map(section => ({
      section,
      items: sortByPosition(bySection.get(section.id) ?? []),
    }))
    return [top, ...rest]
  })

  const isEmpty = computed(() => items.value.length === 0 && sections.value.length === 0)
  // Only the first load shows a loading state: later refetches (focus, realtime resubscribe) keep the list on screen,
  // or an empty list would flash a skeleton and unmount whatever form was open. The list id is known once loaded.
  const initialLoading = computed(() => pending.value && data.value.listId === null)
  const remaining = computed(() => items.value.length)

  function removeLocal(id: string) {
    data.value = {
      ...data.value,
      items: data.value.items.filter(i => i.id !== id),
    }
  }

  function restoreLocal(item: ShoppingItem) {
    data.value = {
      ...data.value,
      items: [...data.value.items.filter(i => i.id !== item.id), item],
    }
  }

  // The last ticked item, for Undo. `deleted` settles when its delete has finished (undo must not race it).
  let lastDone: { item: ShoppingItem, deleted: Promise<boolean> } | null = null

  async function deleteItemRow(item: ShoppingItem): Promise<boolean> {
    const { error: deleteError } = await tracked(supabase.from('shopping_items').delete().eq('id', item.id))
    if (deleteError) {
      restoreLocal(item)
      // The row is back, so its Undo toast has nothing to undo.
      if (lastDone?.item.id === item.id) {
        lastDone = null
        toast.dismiss(DONE_TOAST_ID)
      }
      toast.error(`Could not remove “${item.name}”. Please try again.`)
      return false
    }
    return true
  }

  /** Puts the last ticked item back where it was (its section, or the top area if that section is gone). */
  async function undoDone() {
    const done = lastDone
    lastDone = null
    toast.dismiss(DONE_TOAST_ID)
    if (!done || !(await done.deleted) || !data.value.listId || !householdId.value) {
      return
    }
    const sectionId = done.item.sectionId && sections.value.some(s => s.id === done.item.sectionId)
      ? done.item.sectionId
      : null
    const item = {
      ...done.item,
      sectionId,
    }
    restoreLocal(item)
    const { error: insertError } = await tracked(supabase.from('shopping_items').insert({
      id: item.id,
      list_id: data.value.listId,
      household_id: householdId.value,
      section_id: item.sectionId,
      name: item.name,
      position: item.position,
    }))
    if (insertError) {
      removeLocal(item.id)
      toast.error(`Could not bring back “${item.name}”.`)
    }
  }

  /**
   * Ticking an item removes it from the list and deletes it (features/SHOPPING.md §6, D22): a bought item is no
   * use on the list, and the other member sees it gone at once. One toast, updated per tick, undoes the latest.
   */
  function completeItem(item: ShoppingItem) {
    removeWithUndo(item, `✓ ${item.name}`)
  }

  /** Deleting from the item editor (SHOP-007): same as ticking, with its own wording. */
  function deleteItem(item: ShoppingItem) {
    removeWithUndo(item, `Deleted “${item.name}”`)
  }

  function removeWithUndo(item: ShoppingItem, message: string) {
    if (item.pending) {
      return
    }
    removeLocal(item.id)
    lastDone = {
      item,
      deleted: deleteItemRow(item),
    }
    toast(message, {
      id: DONE_TOAST_ID,
      duration: DONE_TOAST_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          void undoDone()
        },
      },
    })
  }

  /** Saved items of a group (section id, or null for the top area), in display order. Pending rows are left out. */
  function savedGroup(sectionId: string | null): ShoppingItem[] {
    return sortByPosition(data.value.items.filter(i => i.sectionId === sectionId))
  }

  async function writePositions(
    table: 'shopping_items' | 'shopping_sections',
    updates: PositionUpdate[],
    moved?: { id: string, sectionId: string | null },
  ): Promise<boolean> {
    // Normally a single row; a renumbered group (rare) writes each of its rows.
    const results = await Promise.all(updates.map((u) => {
      if (table === 'shopping_items' && moved && u.id === moved.id) {
        return tracked(supabase.from('shopping_items').update({ position: u.position, section_id: moved.sectionId }).eq('id', u.id))
      }
      return tracked(supabase.from(table).update({ position: u.position }).eq('id', u.id))
    }))
    return results.every(r => !r.error)
  }

  /**
   * Moves an item to `index` within a section (null = top area), from the same or another section (SHOP-008).
   * Writes only the moved row unless the target group had to be renumbered. `index` defaults to the end.
   * On failure the list is reloaded (the server state is the truth) with a toast.
   */
  async function moveItem(item: ShoppingItem, sectionId: string | null, index?: number) {
    if (item.pending) {
      return
    }
    const group = savedGroup(sectionId)
    const updates = planMove(group, item.id, index ?? group.length)
    if (updates.length === 0 && item.sectionId === sectionId) {
      return
    }
    // Same position number but another section (e.g. moved to an empty section at STEP): still write the section.
    const writes = updates.some(u => u.id === item.id)
      ? updates
      : [...updates, { id: item.id, position: item.position }]
    const byId = new Map(writes.map(u => [u.id, u.position]))
    data.value = {
      ...data.value,
      items: data.value.items.map((i) => {
        const position = byId.get(i.id)
        if (position === undefined) {
          return i
        }
        return {
          ...i,
          position,
          sectionId: i.id === item.id ? sectionId : i.sectionId,
        }
      }),
    }
    const ok = await writePositions('shopping_items', writes, { id: item.id, sectionId })
    if (!ok) {
      toast.error(`Could not move “${item.name}”.`)
      await refresh()
    }
  }

  /** Moves a section to `index` among the sections (SHOP-008); its items go with it. */
  async function moveSection(section: ShoppingSection, index: number) {
    if (section.pending) {
      return
    }
    const updates = planMove(sortByPosition(data.value.sections), section.id, index)
    if (updates.length === 0) {
      return
    }
    const byId = new Map(updates.map(u => [u.id, u.position]))
    data.value = {
      ...data.value,
      sections: data.value.sections.map((s) => {
        const position = byId.get(s.id)
        if (position === undefined) {
          return s
        }
        return {
          ...s,
          position,
        }
      }),
    }
    const ok = await writePositions('shopping_sections', updates)
    if (!ok) {
      toast.error(`Could not move the “${section.name}” section.`)
      await refresh()
    }
  }

  /**
   * Renames an item at once (name already validated); rolls back with a toast if saving fails. If the other member
   * ticked it off meanwhile, the update matches nothing and the item leaves the list here too.
   */
  async function renameItem(item: ShoppingItem, name: string): Promise<boolean> {
    if (name === item.name || item.pending) {
      return true
    }
    restoreLocal({
      ...item,
      name,
    })
    const { data: updated, error: updateError } = await tracked(supabase
      .from('shopping_items')
      .update({ name })
      .eq('id', item.id)
      .select('id'))
    if (updateError) {
      restoreLocal(item)
      toast.error('Could not rename the item. Please try again.')
      return false
    }
    if (updated.length === 0) {
      removeLocal(item.id)
      toast(`“${item.name}” was already removed from the list.`)
      return false
    }
    return true
  }

  /**
   * Adds items (already cleaned, e.g. by `parseItemLines`) to the end of a section (null = top area), in order.
   * They show at once and are saved in one insert; on failure they are removed again and false is returned so
   * the caller can keep the text.
   */
  async function addItems(names: string[], sectionId: string | null): Promise<boolean> {
    const listId = data.value.listId
    if (!listId || !householdId.value || names.length === 0) {
      return false
    }
    // Rapid entry: earlier adds may still be pending, so count them when finding the end of the section.
    let position = positionAtEnd(items.value.filter(i => i.sectionId === sectionId))
    const added: ShoppingItem[] = names.map((name) => {
      const item = {
        id: crypto.randomUUID(),
        sectionId,
        name,
        position,
        pending: true,
      }
      position += 1
      return item
    })
    pendingAdds.value = [...pendingAdds.value, ...added]

    const { error: insertError } = await tracked(supabase.from('shopping_items').insert(added.map(item => ({
      id: item.id,
      list_id: listId,
      household_id: householdId.value!,
      section_id: item.sectionId,
      name: item.name,
      position: item.position,
    }))))

    const ids = new Set(added.map(i => i.id))
    pendingAdds.value = pendingAdds.value.filter(i => !ids.has(i.id))
    if (insertError) {
      if (names.length === 1) {
        // The caller puts the text back into the input.
        toast.error('Could not add the item. Please try again.')
      } else {
        toast.error(`Could not add ${names.length} items.`, {
          duration: 10_000,
          action: {
            label: 'Retry',
            onClick: () => {
              void addItems(names, sectionId)
            },
          },
        })
      }
      return false
    }
    // Saved: keep them in the list (a fetch may already have brought them in).
    const known = new Set(data.value.items.map(i => i.id))
    data.value = {
      ...data.value,
      items: [
        ...data.value.items,
        ...added.filter(i => !known.has(i.id)).map(({ pending: _pending, ...item }) => item),
      ],
    }
    return true
  }

  /** Adds a section at the end (name already validated). Returns its id, or null if saving failed. */
  async function createSection(name: string): Promise<string | null> {
    const listId = data.value.listId
    if (!listId || !householdId.value) {
      return null
    }
    const section: ShoppingSection = {
      id: crypto.randomUUID(),
      name,
      position: positionAtEnd([...data.value.sections, ...pendingSections.value]),
      pending: true,
    }
    pendingSections.value = [...pendingSections.value, section]
    const { error: insertError } = await tracked(supabase.from('shopping_sections').insert({
      id: section.id,
      list_id: listId,
      household_id: householdId.value,
      name: section.name,
      position: section.position,
    }))
    pendingSections.value = pendingSections.value.filter(s => s.id !== section.id)
    if (insertError) {
      toast.error(`Could not add the “${name}” section. Please try again.`)
      return null
    }
    if (!data.value.sections.some(s => s.id === section.id)) {
      const { pending: _pending, ...saved } = section
      data.value = {
        ...data.value,
        sections: [...data.value.sections, saved],
      }
    }
    return section.id
  }

  function patchSection(id: string, fields: Partial<ShoppingSection>) {
    data.value = {
      ...data.value,
      sections: data.value.sections.map((section) => {
        if (section.id !== id) {
          return section
        }
        return {
          ...section,
          ...fields,
        }
      }),
    }
  }

  /** Renames a section at once (name already validated); rolls back with a toast if saving fails. */
  async function renameSection(section: ShoppingSection, name: string): Promise<boolean> {
    if (name === section.name) {
      return true
    }
    patchSection(section.id, { name })
    const { error: updateError } = await tracked(supabase.from('shopping_sections').update({ name }).eq('id', section.id))
    if (updateError) {
      patchSection(section.id, { name: section.name })
      toast.error('Could not rename the section. Please try again.')
      return false
    }
    return true
  }

  function unhideSection(id: string) {
    const next = new Set(hiddenSectionIds.value)
    next.delete(id)
    hiddenSectionIds.value = next
  }

  /**
   * Removes a section locally and moves its items to the end of the top area, in order — what the database trigger
   * does on delete (D24), so the screen matches before the server's updates arrive.
   */
  function releaseSectionLocal(id: string) {
    const end = Math.max(0, ...data.value.items.filter(i => i.sectionId === null).map(i => i.position))
    const moved = new Map(sortByPosition(data.value.items.filter(i => i.sectionId === id)).map((i, n) => [i.id, end + n + 1]))
    data.value = {
      ...data.value,
      sections: data.value.sections.filter(s => s.id !== id),
      items: data.value.items.map((i) => {
        const position = moved.get(i.id)
        if (position === undefined) {
          return i
        }
        return {
          ...i,
          sectionId: null,
          position,
        }
      }),
    }
  }

  async function deleteSectionNow(id: string) {
    pendingDeletes.delete(id)
    // Its items stay, moved to the top area by the database trigger (D24).
    const { error: deleteError } = await tracked(supabase.from('shopping_sections').delete().eq('id', id))
    if (deleteError) {
      toast.error('Could not delete the section.')
    } else {
      releaseSectionLocal(id)
    }
    unhideSection(id)
  }

  function flushDeletes() {
    for (const [id, timer] of pendingDeletes) {
      clearTimeout(timer)
      void deleteSectionNow(id)
    }
  }

  /**
   * Delete with undo (features/SHOPPING.md §10, D24): the heading disappears at once and its items move to the end of
   * the top area ("No section"); the delete runs when the undo window ends, so Undo puts everything back.
   */
  function deleteSection(section: ShoppingSection) {
    const count = items.value.filter(i => i.sectionId === section.id).length
    hiddenSectionIds.value = new Set([...hiddenSectionIds.value, section.id])
    pendingDeletes.set(section.id, setTimeout(() => void deleteSectionNow(section.id), UNDO_TOAST_MS))
    const what = count === 0 ? '' : count === 1 ? '; its item moved to No section' : `; its ${count} items moved to No section`
    toast(`Deleted “${section.name}”${what}`, {
      duration: UNDO_TOAST_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(pendingDeletes.get(section.id))
          pendingDeletes.delete(section.id)
          unhideSection(section.id)
        },
      },
    })
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Realtime (SHOP-009): the other member's changes arrive as Postgres Changes and are merged by id. Our own writes
  // come back as echoes too; merging is idempotent (an insert/update replaces the row by id, a delete of an unknown id
  // is ignored), so echoes need no special handling and a late echo is corrected by the next one.
  // ---------------------------------------------------------------------------------------------------------------
  function upsertItemFromRow(row: ItemRow) {
    const item: ShoppingItem = {
      id: row.id,
      sectionId: row.section_id,
      name: row.name,
      position: row.position,
    }
    data.value = {
      ...data.value,
      items: [...data.value.items.filter(i => i.id !== item.id), item],
    }
  }

  function upsertSectionFromRow(row: SectionRow) {
    const section: ShoppingSection = {
      id: row.id,
      name: row.name,
      position: row.position,
    }
    data.value = {
      ...data.value,
      sections: [...data.value.sections.filter(s => s.id !== section.id), section],
    }
  }

  // While a drag is in progress SortableJS moves rows in the DOM; re-rendering the list then would break the drag.
  // Realtime events and refetches wait until it ends (a drag counts as a write in flight for the fetch guard).
  let dragging = false
  let heldEvents: (() => void)[] = []

  function whenNotDragging(apply: () => void) {
    if (dragging) {
      heldEvents.push(apply)
    } else {
      apply()
    }
  }

  /** Called by the page when an item or section drag starts and ends (dropped or cancelled). */
  function setDragging(active: boolean) {
    if (active === dragging) {
      return
    }
    dragging = active
    if (active) {
      writesInFlight++
      return
    }
    const held = heldEvents
    heldEvents = []
    for (const apply of held) {
      apply()
    }
    writesInFlight--
    if (writesInFlight === 0 && refetchAfterWrites) {
      refetchAfterWrites = false
      void refresh()
    }
  }

  function onItemChange(payload: RealtimePostgresChangesPayload<ItemRow>) {
    if (dragging) {
      whenNotDragging(() => onItemChange(payload))
      return
    }
    if (payload.eventType === 'DELETE') {
      const id = payload.old.id
      if (id) {
        removeLocal(id)
      }
      return
    }
    upsertItemFromRow(payload.new)
  }

  function onSectionChange(payload: RealtimePostgresChangesPayload<SectionRow>) {
    if (dragging) {
      whenNotDragging(() => onSectionChange(payload))
      return
    }
    if (payload.eventType === 'DELETE') {
      const id = payload.old.id
      if (id) {
        // Its items moved to the top area (their update events follow and agree with this).
        releaseSectionLocal(id)
      }
      return
    }
    upsertSectionFromRow(payload.new)
  }

  let channel: RealtimeChannel | null = null

  function unsubscribe() {
    if (channel) {
      void supabase.removeChannel(channel)
      channel = null
    }
  }

  function subscribe(listId: string) {
    unsubscribe()
    const filter = `list_id=eq.${listId}`
    channel = supabase
      .channel(`shopping:${listId}`)
      .on<ItemRow>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shopping_items', filter }, onItemChange)
      .on<ItemRow>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shopping_items', filter }, onItemChange)
      // Delete events cannot be filtered by column; unknown ids are ignored.
      .on<ItemRow>('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shopping_items' }, onItemChange)
      .on<SectionRow>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shopping_sections', filter }, onSectionChange)
      .on<SectionRow>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shopping_sections', filter }, onSectionChange)
      .on<SectionRow>('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shopping_sections' }, onSectionChange)
      .subscribe((status) => {
        // Refetch on every (re)subscribe: changes made between the page's first load and the subscription, or while
        // disconnected, produced no events for us.
        if (status === 'SUBSCRIBED') {
          void refresh()
        }
      })
  }

  if (import.meta.client) {
    watch(() => data.value.listId, (listId) => {
      if (listId) {
        subscribe(listId)
      } else {
        unsubscribe()
      }
    }, { immediate: true })
    onBeforeUnmount(unsubscribe)

    useEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Leaving the app ends the undo window: delete now rather than risk the request never being sent.
        flushDeletes()
      } else {
        // Back in the foreground: phones suspend sockets in the background, so catch up on anything missed.
        void refresh()
      }
    })
    // Leaving the page (in-app navigation) also ends the undo window.
    onBeforeUnmount(flushDeletes)
  }

  return {
    groups,
    sections,
    addItems,
    createSection,
    renameSection,
    deleteSection,
    isEmpty,
    initialLoading,
    remaining,
    pending,
    error,
    refresh,
    completeItem,
    deleteItem,
    renameItem,
    moveItem,
    moveSection,
    setDragging,
  }
}
