<script setup lang="ts">
// Placeholder app home: AppShell and `/` → `/tasks` come in FOUNDATION-010.
// Shows the invite until a household settings page exists.
const { signOut } = useAuth()
const { membership } = useMembership()
const { fetchHousehold } = useHousehold()

const { data: household } = await useAsyncData('current-household', async () => {
  const householdId = membership.value?.householdId
  return householdId ? await fetchHousehold(householdId) : null
})

useHead({
  title: () => household.value?.name ?? 'Home',
})
</script>

<template>
  <main class="mx-auto max-w-sm space-y-8 px-4 py-8">
    <h1 class="text-xl font-semibold" dir="auto">
      {{ household?.name ?? 'Home' }}
    </h1>
    <HouseholdInvite v-if="household" :household-name="household.name" :invite-code="household.inviteCode" />
    <Button variant="outline" @click="signOut">
      Log out
    </Button>
  </main>
</template>
