import { randomUUID } from 'node:crypto'
import { adminClient } from '../../supabase/tests/helpers'

export interface E2eUser {
  displayName: string
  email: string
  password: string
}

/** A fresh, unique user for one test (signed up through the UI, removed by `deleteUser`). */
export function newUser(label: string): E2eUser {
  const id = randomUUID().slice(0, 8)
  return {
    displayName: `E2E ${label}`,
    email: `e2e-${label}-${id}@e2e-test.example.com`,
    password: `pw-${randomUUID()}`,
  }
}

/** Deletes the user and the households they belong to (households cascade to members and notes). */
export async function deleteUser(email: string): Promise<void> {
  const admin = adminClient()
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) {
    throw new Error(`listUsers failed: ${error.message}`)
  }
  const user = data.users.find(u => u.email === email)
  if (!user) {
    return
  }
  const { data: memberships } = await admin.from('household_members').select('household_id').eq('user_id', user.id)
  const householdIds = (memberships ?? []).map(m => m.household_id)
  if (householdIds.length) {
    await admin.from('households').delete().in('id', householdIds)
  }
  await admin.auth.admin.deleteUser(user.id)
}

/** Invite code of the household `email` belongs to (read with the service role). */
export async function inviteCodeOf(email: string): Promise<string> {
  const admin = adminClient()
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const user = data?.users.find(u => u.email === email)
  if (error || !user) {
    throw new Error(`inviteCodeOf: user not found (${error?.message ?? email})`)
  }
  const { data: membership } = await admin.from('household_members').select('households(invite_code)').eq('user_id', user.id).single()
  const code = membership?.households?.invite_code
  if (!code) {
    throw new Error('inviteCodeOf: no household')
  }
  return code
}
