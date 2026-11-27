// Local demo data: a demo account with a household and realistic tasks (docs/05-UI-UX-GUIDELINES.md "Test data").
//   npm run db:seed-demo     (local Supabase only; re-running recreates the demo account from scratch)
// Log in at http://localhost:3000 with the DEMO_EMAIL / DEMO_PASSWORD below (local test values, not secrets).
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types.ts'
import { addDays, localToday } from '../shared/recurrence.ts'

const DEMO_EMAIL = 'demo@house.test'
const DEMO_PASSWORD = 'demo-password-local'
const TIMEZONE = 'Asia/Jerusalem'

if (existsSync('.env')) {
  process.loadEnvFile('.env')
}
const url = process.env.SUPABASE_URL ?? ''
const secretKey = process.env.SUPABASE_SECRET_KEY ?? ''
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url) || !secretKey) {
  console.error('Refusing to run: SUPABASE_URL must be the local stack (http://127.0.0.1:54321) and SUPABASE_SECRET_KEY set.')
  process.exit(1)
}

const admin = createClient<Database>(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

async function main() {
  // Start from scratch: delete the previous demo user and their household.
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const old = users?.users.find(u => u.email === DEMO_EMAIL)
  if (old) {
    const { data: memberships } = await admin.from('household_members').select('household_id').eq('user_id', old.id)
    const ids = (memberships ?? []).map(m => m.household_id)
    if (ids.length) {
      await admin.from('households').delete().in('id', ids)
    }
    await admin.auth.admin.deleteUser(old.id)
  }

  const created = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: 'Dana' },
  })
  if (created.error || !created.data.user) {
    throw new Error(`createUser: ${created.error?.message}`)
  }
  const userId = created.data.user.id

  // Create the household through the real RPC (seeds categories and rooms), signed in as the demo user.
  const userClient = createClient<Database>(url, process.env.SUPABASE_KEY ?? '', { auth: { persistSession: false } })
  const signIn = await userClient.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
  if (signIn.error) {
    throw new Error(`signIn: ${signIn.error.message}`)
  }
  const { data: householdId, error: rpcError } = await userClient.rpc('create_household', { p_name: 'Our home', p_timezone: TIMEZONE })
  if (rpcError || !householdId) {
    throw new Error(`create_household: ${rpcError?.message}`)
  }

  const [{ data: categories }, { data: rooms }] = await Promise.all([
    admin.from('task_categories').select('id, name').eq('household_id', householdId),
    admin.from('rooms').select('id, name').eq('household_id', householdId),
  ])
  const category = (name: string) => categories?.find(c => c.name === name)?.id ?? null
  const room = (name: string) => rooms?.find(r => r.name === name)?.id ?? null
  const today = localToday(TIMEZONE)
  const due = (days: number) => addDays(today, days)

  type Unit = 'day' | 'week' | 'month' | 'year'
  const recurring = (title: string, unit: Unit, interval: number, dueIn: number, cat: string | null, rm: string | null) => ({
    title,
    kind: 'recurring',
    recurrence_unit: unit,
    recurrence_interval: interval,
    due_date: due(dueIn),
    category_id: cat ? category(cat) : null,
    room_id: rm ? room(rm) : null,
  })
  const oneTime = (title: string, dueIn: number | null, cat: string | null, rm: string | null) => ({
    title,
    kind: 'one_time',
    due_date: dueIn === null ? null : due(dueIn),
    category_id: cat ? category(cat) : null,
    room_id: rm ? room(rm) : null,
  })

  const tasks = [
    recurring('Clean AC filters', 'month', 3, -4, 'Maintenance', 'Living room'),
    recurring('Water plants', 'week', 1, 0, null, 'Balcony'),
    oneTime('Fix bathroom faucet', 2, 'Maintenance', 'Bathroom'),
    recurring('Change bed sheets', 'week', 2, 5, 'Cleaning', 'Bedroom'),
    recurring('Descale the kettle', 'month', 1, 9, 'Cleaning', 'Kitchen'),
    oneTime('Renew home insurance', 20, 'General', null),
    recurring('Prepare balcony for winter', 'year', 1, 41, 'Maintenance', 'Balcony'),
    oneTime('לקנות מנורה לסלון', null, null, 'Living room'),
    oneTime('Call the plumber about the boiler', null, 'Maintenance', null),
  ]
  const { data: inserted, error: insertError } = await admin.from('tasks').insert(
    tasks.map(t => ({ ...t, household_id: householdId, created_by: userId })),
  ).select('id, title')
  if (insertError) {
    throw new Error(`insert tasks: ${insertError.message}`)
  }

  // Some completion history for the task sheet: "Water plants" done weekly, sometimes late.
  const waterPlants = inserted?.find(t => t.title === 'Water plants')
  if (waterPlants) {
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
    const history: [doneDaysAgo: number, dueDaysAgo: number][] = [[7, 7], [15, 16], [20, 23], [30, 30]]
    const { error: historyError } = await admin.from('task_completions').insert(history.map(([done, dueAgo]) => ({
      task_id: waterPlants.id,
      household_id: householdId,
      completed_by: userId,
      completed_at: daysAgo(done),
      due_date_at_completion: due(-dueAgo),
    })))
    if (historyError) {
      throw new Error(`insert history: ${historyError.message}`)
    }
    await admin.from('tasks').update({ last_completed_at: daysAgo(7) }).eq('id', waterPlants.id)
  }
  console.log(`Demo ready: ${tasks.length} tasks in "Our home" (${TIMEZONE}). Log in as ${DEMO_EMAIL}.`)
}

await main()
