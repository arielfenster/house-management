import { toast } from 'vue-sonner'
import { sortByPosition } from '#shared/shopping-position'

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

  const groups = computed((): ShoppingGroup[] => {
    const bySection = new Map<string | null, ShoppingItem[]>()
    for (const item of data.value.items) {
      const key = item.sectionId
      bySection.set(key, [...(bySection.get(key) ?? []), item])
    }
    const top: ShoppingGroup = {
      section: null,
      items: sortByPosition(bySection.get(null) ?? []),
    }
    const sections = sortByPosition(data.value.sections).map(section => ({
      section,
      items: sortByPosition(bySection.get(section.id) ?? []),
    }))
    return [top, ...sections]
  })

  const isEmpty = computed(() => data.value.items.length === 0 && data.value.sections.length === 0)
  const remaining = computed(() => data.value.items.filter(i => !i.checked).length)

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

  return {
    groups,
    isEmpty,
    remaining,
    pending,
    error,
    refresh,
    setChecked,
  }
}
