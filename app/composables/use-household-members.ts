export interface HouseholdMember {
  id: string
  displayName: string
}

/**
 * Members of the signed-in user's household (for assignment). RLS on `profiles` returns exactly the caller and
 * their co-members, so no household filter is needed.
 */
export function useHouseholdMembers() {
  const supabase = useSupabaseClient()
  const { membership } = useMembership()
  const householdId = computed(() => membership.value?.householdId ?? null)

  return useAsyncData(
    'household-members',
    async (): Promise<HouseholdMember[]> => {
      if (!householdId.value) {
        return []
      }
      const { data, error } = await supabase.from('profiles').select('id, display_name').order('display_name')
      if (error) {
        return []
      }
      return data.map(p => ({
        id: p.id,
        displayName: p.display_name,
      }))
    },
    {
      watch: [householdId],
      default: () => [],
    },
  )
}
