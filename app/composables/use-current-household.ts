/** The signed-in member's household (name, invite code…), shared by the shell, headers and the account sheet. */
export function useCurrentHousehold() {
  const { membership } = useMembership()
  const { fetchHousehold } = useHousehold()
  const householdId = computed(() => membership.value?.householdId ?? null)

  return useAsyncData(
    'current-household',
    async () => {
      return householdId.value ? await fetchHousehold(householdId.value) : null
    },
    { watch: [householdId] },
  )
}

/** Open state of the account sheet (household, invite, log out); one sheet mounted by AppShell. */
export function useAccountSheetOpen() {
  return useState('account-sheet-open', () => false)
}
