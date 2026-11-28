import { useEventListener } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { positionAtEnd, sortByPosition } from '#shared/shopping-position'

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

  const { data, pending, error, refresh } = useAsyncData(
    'shopping',
    async (): Promise<ShoppingData> => {
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

  // Added rows waiting for their insert. Kept apart from `data` so a fetch that lands meanwhile cannot drop them;
  // they carry their final id (generated here), so once the fetch has them the copy here is ignored.
  const pendingAdds = ref<ShoppingItem[]>([])

  // Same for sections being created.
  const pendingSections = ref<ShoppingSection[]>([])

  // Deleted sections stay hidden (with their items) during the undo window; the delete runs when it ends.
  const hiddenSectionIds = ref(new Set<string>())
  const pendingDeletes = new Map<string, ReturnType<typeof setTimeout>>()

  const items = computed((): ShoppingItem[] => {
    const saved = new Set(data.value.items.map(i => i.id))
    return [...data.value.items, ...pendingAdds.value.filter(i => !saved.has(i.id))]
      .filter(i => i.sectionId === null || !hiddenSectionIds.value.has(i.sectionId))
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
    const top: ShoppingGroup = {
      section: null,
      items: sortByPosition(bySection.get(null) ?? []),
    }
    const rest = sections.value.map(section => ({
      section,
      items: sortByPosition(bySection.get(section.id) ?? []),
    }))
    return [top, ...rest]
  })

  const isEmpty = computed(() => items.value.length === 0 && sections.value.length === 0)
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
    const { error: deleteError } = await supabase.from('shopping_items').delete().eq('id', item.id)
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
    const { error: insertError } = await supabase.from('shopping_items').insert({
      id: item.id,
      list_id: data.value.listId,
      household_id: householdId.value,
      section_id: item.sectionId,
      name: item.name,
      position: item.position,
    })
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
    const { data: updated, error: updateError } = await supabase
      .from('shopping_items')
      .update({ name })
      .eq('id', item.id)
      .select('id')
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

    const { error: insertError } = await supabase.from('shopping_items').insert(added.map(item => ({
      id: item.id,
      list_id: listId,
      household_id: householdId.value!,
      section_id: item.sectionId,
      name: item.name,
      position: item.position,
    })))

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
    const { error: insertError } = await supabase.from('shopping_sections').insert({
      id: section.id,
      list_id: listId,
      household_id: householdId.value,
      name: section.name,
      position: section.position,
    })
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
    const { error: updateError } = await supabase.from('shopping_sections').update({ name }).eq('id', section.id)
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

  async function deleteSectionNow(id: string) {
    pendingDeletes.delete(id)
    // Its items go with it (on delete cascade, D16).
    const { error: deleteError } = await supabase.from('shopping_sections').delete().eq('id', id)
    if (deleteError) {
      toast.error('Could not delete the section.')
    } else {
      data.value = {
        ...data.value,
        sections: data.value.sections.filter(s => s.id !== id),
        items: data.value.items.filter(i => i.sectionId !== id),
      }
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
   * Delete with undo (features/SHOPPING.md §10, D16): the section and its items disappear at once; the delete runs
   * when the undo window ends, so Undo loses nothing.
   */
  function deleteSection(section: ShoppingSection) {
    const count = items.value.filter(i => i.sectionId === section.id).length
    hiddenSectionIds.value = new Set([...hiddenSectionIds.value, section.id])
    pendingDeletes.set(section.id, setTimeout(() => void deleteSectionNow(section.id), UNDO_TOAST_MS))
    const what = count === 0 ? '' : count === 1 ? ' and 1 item' : ` and ${count} items`
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

  if (import.meta.client) {
    // Leaving the app ends the undo window: delete now rather than risk the request never being sent.
    useEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushDeletes()
      }
    })
    // Leaving the page (in-app navigation) also ends it.
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
    remaining,
    pending,
    error,
    refresh,
    completeItem,
    deleteItem,
    renameItem,
  }
}
