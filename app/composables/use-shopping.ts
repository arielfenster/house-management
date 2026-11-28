import { toast } from 'vue-sonner'
import { positionAtEnd, sortByPosition } from '#shared/shopping-position'

export interface ShoppingSection {
  id: string
  name: string
  position: number
}

export interface ShoppingItem {
  id: string
  /** null = the top area above the first section. */
  sectionId: string | null
  name: string
  checked: boolean
  position: number
  /** Optimistic row whose insert has not finished yet. */
  pending?: boolean
}

/** Items of one section (or of the top area, `section` null), in display order. */
export interface ShoppingGroup {
  section: ShoppingSection | null
  items: ShoppingItem[]
}

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
        supabase.from('shopping_items').select('id, section_id, name, checked, position').eq('list_id', list.id),
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
          checked: row.checked,
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

  const items = computed((): ShoppingItem[] => {
    const saved = new Set(data.value.items.map(i => i.id))
    return [...data.value.items, ...pendingAdds.value.filter(i => !saved.has(i.id))]
  })

  const sections = computed(() => sortByPosition(data.value.sections))

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

  const isEmpty = computed(() => items.value.length === 0 && data.value.sections.length === 0)
  const remaining = computed(() => items.value.filter(i => !i.checked).length)

  function patchItem(id: string, fields: Partial<ShoppingItem>) {
    data.value = {
      ...data.value,
      items: data.value.items.map((item) => {
        if (item.id !== id) {
          return item
        }
        return {
          ...item,
          ...fields,
        }
      }),
    }
  }

  // Taps on the same item may overlap: only the latest one's failure rolls back (an older failure would undo it).
  const toggleVersion = new Map<string, number>()

  /** Ticks or un-ticks an item at once, then saves; rolls back with a toast if saving fails. */
  async function setChecked(item: ShoppingItem, checked: boolean) {
    const version = (toggleVersion.get(item.id) ?? 0) + 1
    toggleVersion.set(item.id, version)
    patchItem(item.id, { checked })

    const { error: updateError } = await supabase.from('shopping_items').update({ checked }).eq('id', item.id)
    if (updateError && toggleVersion.get(item.id) === version) {
      patchItem(item.id, { checked: !checked })
      toast.error(`Could not update “${item.name}”. Please try again.`)
    }
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
        checked: false,
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

  return {
    groups,
    sections,
    addItems,
    isEmpty,
    remaining,
    pending,
    error,
    refresh,
    setChecked,
  }
}
