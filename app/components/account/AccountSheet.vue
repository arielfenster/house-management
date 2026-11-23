<script setup lang="ts">
import { LogOutIcon } from '@lucide/vue'

// Household + account panel: the only place outside the four nav items (invite, log out).
const open = useAccountSheetOpen()
const { data: household } = useCurrentHousehold()
const { signOut } = useAuth()

async function logOut() {
  open.value = false
  await signOut()
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="household?.name ?? 'Household'"
    description="Invite members and manage your account."
  >
    <div class="space-y-6 pb-2">
      <HouseholdInvite v-if="household" :household-name="household.name" :invite-code="household.inviteCode" />
      <Button variant="outline" class="w-full" @click="logOut">
        <LogOutIcon />
        Log out
      </Button>
    </div>
  </ResponsiveSheet>
</template>
