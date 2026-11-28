// Local demo data for looking at the UI: a household with two members and ~40 varied tasks
// (docs/05-UI-UX-GUIDELINES.md "Test data").
//   npm run db:seed-demo     (local Supabase only; re-running recreates both demo accounts from scratch)
// Log in at http://localhost:3000 as either member (local test values, not secrets):
//   Dana  demo@house.test   / demo-password-local
//   Noa   demo2@house.test  / demo-password-local
// What you get: overdue / today / this week / later / undated tasks; one-time and repeating (daily → yearly);
// assigned to Dana, Noa or nobody; notes; long and Hebrew titles; extra categories and rooms; completed one-time
// tasks (Done tab); completion history (on time, late, early, by both members) on several repeating tasks.
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types.ts'
import { addDays, localToday, type RecurrenceUnit } from '../shared/recurrence.ts'

const PASSWORD = 'demo-password-local'
const DANA = { email: 'demo@house.test', name: 'Dana' }
const NOA = { email: 'demo2@house.test', name: 'Noa' }
const TIMEZONE = 'Asia/Jerusalem'

if (existsSync('.env')) {
  process.loadEnvFile('.env')
}
const url = process.env.SUPABASE_URL ?? ''
const secretKey = process.env.SUPABASE_SECRET_KEY ?? ''
const publishableKey = process.env.SUPABASE_KEY ?? ''
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url) || !secretKey || !publishableKey) {
  console.error('Refusing to run: SUPABASE_URL must be the local stack (http://127.0.0.1:54321), with SUPABASE_KEY and SUPABASE_SECRET_KEY set.')
  process.exit(1)
}

const admin = createClient<Database>(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

type Who = 'dana' | 'noa' | null

interface DemoTask {
  title: string
  /** Days from today (negative = overdue); null = no due date (one-time only). */
  due: number | null
  every?: [interval: number, unit: RecurrenceUnit]
  category?: string
  room?: string
  assignee?: Who
  notes?: string
  /** One-time tasks: completed this many days ago (shows in the Done tab). */
  doneDaysAgo?: number
  /** Repeating tasks: past completions as [days ago, days late (negative = early), who]. */
  history?: [daysAgo: number, late: number, who: Exclude<Who, null>][]
}

// Default categories: Cleaning, Maintenance, General. Default rooms: Kitchen, Bathroom, Living room, Bedroom, Balcony.
const EXTRA_CATEGORIES = ['Garden', 'Pets', 'Shopping']
const EXTRA_ROOMS = ['Laundry', 'Garage', 'Kids\' room']

const TASKS: DemoTask[] = [
  // Overdue
  { title: 'Clean AC filters', due: -4, every: [3, 'month'], category: 'Maintenance', room: 'Living room', assignee: 'dana', history: [[95, 2, 'dana'], [190, 0, 'noa']] },
  { title: 'Pay the water bill', due: -2, category: 'General', assignee: 'noa', notes: 'Reference number is on the fridge.' },
  { title: 'Change bed sheets', due: -1, every: [2, 'week'], category: 'Cleaning', room: 'Bedroom', history: [[15, 1, 'noa'], [29, 0, 'dana'], [44, 1, 'dana']] },
  { title: 'Replace the smoke detector battery', due: -9, category: 'Maintenance', room: 'Living room' },
  { title: 'Flea treatment for the cat', due: -3, every: [1, 'month'], category: 'Pets', assignee: 'noa', history: [[33, 3, 'noa']] },
  { title: 'לנקות את המקרר', due: -1, every: [1, 'month'], category: 'Cleaning', room: 'Kitchen', assignee: 'dana' },

  // Today
  { title: 'Water plants', due: 0, every: [1, 'week'], category: 'Garden', room: 'Balcony', history: [[7, 0, 'dana'], [15, 1, 'noa'], [20, 3, 'dana'], [30, 0, 'noa'], [36, -1, 'dana']] },
  { title: 'Take out the recycling', due: 0, every: [1, 'week'], room: 'Kitchen', assignee: 'noa', history: [[7, 0, 'noa'], [14, 0, 'noa']] },
  { title: 'Feed the fish', due: 0, every: [1, 'day'], category: 'Pets', room: 'Living room', history: [[1, 0, 'dana'], [2, 0, 'noa'], [3, 1, 'dana']] },
  { title: 'Buy milk and bread', due: 0, category: 'Shopping', assignee: 'dana' },

  // This week
  { title: 'Fix bathroom faucet', due: 2, category: 'Maintenance', room: 'Bathroom', assignee: 'dana', notes: 'Dripping again — probably the washer. Buy a 1/2" one.' },
  { title: 'Vacuum the living room', due: 1, every: [1, 'week'], category: 'Cleaning', room: 'Living room', assignee: 'noa', history: [[6, -1, 'noa'], [13, 0, 'dana']] },
  { title: 'Wash the towels', due: 3, every: [1, 'week'], category: 'Cleaning', room: 'Laundry' },
  { title: 'Book the plumber for the boiler', due: 4, category: 'Maintenance', room: 'Bathroom', assignee: 'noa' },
  { title: 'Clean the oven', due: 5, every: [2, 'month'], category: 'Cleaning', room: 'Kitchen' },
  { title: 'Change bed sheets in the kids\' room', due: 6, every: [2, 'week'], category: 'Cleaning', room: 'Kids\' room', assignee: 'dana' },
  { title: 'להחליף סוללה בשעון', due: 3, category: 'Maintenance', room: 'Living room' },

  // Later
  { title: 'Descale the kettle', due: 9, every: [1, 'month'], category: 'Cleaning', room: 'Kitchen', history: [[22, 1, 'dana']] },
  { title: 'Mow the lawn', due: 10, every: [2, 'week'], category: 'Garden', assignee: 'noa', history: [[4, 0, 'noa'], [18, 2, 'noa']] },
  { title: 'Renew home insurance', due: 20, category: 'General', assignee: 'dana', notes: 'Compare at least two quotes before renewing.' },
  { title: 'Clean the windows', due: 14, every: [3, 'month'], category: 'Cleaning', room: 'Living room' },
  { title: 'Defrost the freezer', due: 25, every: [6, 'month'], category: 'Maintenance', room: 'Kitchen' },
  { title: 'Organize the garage shelves', due: 30, category: 'General', room: 'Garage' },
  { title: 'Vet check-up for the cat', due: 35, every: [1, 'year'], category: 'Pets', assignee: 'noa', history: [[330, 0, 'noa']] },
  { title: 'Prepare balcony for winter', due: 41, every: [1, 'year'], category: 'Maintenance', room: 'Balcony', history: [[324, 6, 'dana']] },
  { title: 'Service the car', due: 60, every: [1, 'year'], room: 'Garage', assignee: 'dana' },
  { title: 'Check the fire extinguisher', due: 90, every: [1, 'year'], category: 'Maintenance', room: 'Kitchen' },
  { title: 'Clean the gutters', due: 120, every: [6, 'month'], category: 'Garden' },
  { title: 'Wash the shower curtain', due: 12, every: [1, 'month'], category: 'Cleaning', room: 'Bathroom', assignee: 'noa' },
  { title: 'Rotate the mattress', due: 45, every: [3, 'month'], room: 'Bedroom' },
  { title: 'לעשות גיבוי לתמונות של המשפחה מהטלפונים', due: 16, category: 'General', assignee: 'dana' },

  // No date
  { title: 'Call the plumber about the boiler pressure valve and the leaking expansion tank', due: null, category: 'Maintenance', room: 'Bathroom' },
  { title: 'לקנות מנורה לסלון', due: null, room: 'Living room' },
  { title: 'Hang the picture frames in the hallway', due: null, assignee: 'noa' },
  { title: 'Sort out the kids\' old clothes for donation', due: null, room: 'Kids\' room' },
  { title: 'Find a new dentist', due: null, category: 'General' },
  { title: 'Buy a new doormat', due: null, category: 'Shopping' },
  { title: 'Paint the bedroom door', due: null, category: 'Maintenance', room: 'Bedroom', assignee: 'dana', notes: 'White satin, the same as the hallway.' },

  // Done (one-time, completed)
  { title: 'Buy light bulbs', due: -1, category: 'Shopping', doneDaysAgo: 0, assignee: 'noa' },
  { title: 'Assemble the new bookshelf', due: null, room: 'Living room', doneDaysAgo: 1 },
  { title: 'Return the library books', due: -6, category: 'General', doneDaysAgo: 3, assignee: 'dana' },
  { title: 'Fix the wobbly kitchen chair', due: null, category: 'Maintenance', room: 'Kitchen', doneDaysAgo: 8 },
  { title: 'להזמין טכנאי למזגן', due: -12, category: 'Maintenance', doneDaysAgo: 10, assignee: 'noa' },
]

async function deleteDemoUsers() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const email of [DANA.email, NOA.email]) {
    const user = data?.users.find(u => u.email === email)
    if (!user) {
      continue
    }
    const { data: memberships } = await admin.from('household_members').select('household_id').eq('user_id', user.id)
    const ids = (memberships ?? []).map(m => m.household_id)
    if (ids.length) {
      await admin.from('households').delete().in('id', ids)
    }
    await admin.auth.admin.deleteUser(user.id)
  }
}

/** Creates a confirmed user and returns their id and a client signed in as them. */
async function createMember(member: { email: string, name: string }) {
  const created = await admin.auth.admin.createUser({
    email: member.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: member.name },
  })
  if (created.error || !created.data.user) {
    throw new Error(`createUser ${member.email}: ${created.error?.message}`)
  }
  const client = createClient<Database>(url, publishableKey, { auth: { persistSession: false } })
  const signIn = await client.auth.signInWithPassword({ email: member.email, password: PASSWORD })
  if (signIn.error) {
    throw new Error(`signIn ${member.email}: ${signIn.error.message}`)
  }
  return {
    id: created.data.user.id,
    client,
  }
}

async function main() {
  await deleteDemoUsers()

  // The household is created and joined through the real RPCs (which also seed the default categories and rooms).
  const dana = await createMember(DANA)
  const noa = await createMember(NOA)
  const { data: householdId, error: createError } = await dana.client.rpc('create_household', { p_name: 'Our home', p_timezone: TIMEZONE })
  if (createError || !householdId) {
    throw new Error(`create_household: ${createError?.message}`)
  }
  const { data: household } = await admin.from('households').select('invite_code').eq('id', householdId).single()
  const { error: joinError } = await noa.client.rpc('join_household', { p_invite_code: household?.invite_code ?? '' })
  if (joinError) {
    throw new Error(`join_household: ${joinError.message}`)
  }

  await admin.from('task_categories').insert(EXTRA_CATEGORIES.map(name => ({ household_id: householdId, name })))
  await admin.from('rooms').insert(EXTRA_ROOMS.map(name => ({ household_id: householdId, name })))
  const [{ data: categories }, { data: rooms }] = await Promise.all([
    admin.from('task_categories').select('id, name').eq('household_id', householdId),
    admin.from('rooms').select('id, name').eq('household_id', householdId),
  ])
  const categoryId = (name?: string) => (name && categories?.find(c => c.name === name)?.id) || null
  const roomId = (name?: string) => (name && rooms?.find(r => r.name === name)?.id) || null
  const userId = (who: Who | undefined) => (who === 'dana' ? dana.id : who === 'noa' ? noa.id : null)

  const today = localToday(TIMEZONE)
  const date = (days: number) => addDays(today, days)
  const daysAgo = (n: number, hour = 9) => {
    const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000)
    d.setUTCHours(hour - 2, 15, 0, 0) // ~hour:15 in Israel
    return d.toISOString()
  }

  // Alternate creators so both members "own" tasks.
  const { data: inserted, error: insertError } = await admin.from('tasks').insert(TASKS.map((t, i) => ({
    household_id: householdId,
    created_by: i % 3 === 0 ? noa.id : dana.id,
    title: t.title,
    description: t.notes ?? null,
    kind: t.every ? 'recurring' : 'one_time',
    due_date: t.due === null ? null : date(t.due),
    recurrence_interval: t.every?.[0] ?? null,
    recurrence_unit: t.every?.[1] ?? null,
    category_id: categoryId(t.category),
    room_id: roomId(t.room),
    assigned_to: userId(t.assignee),
  }))).select('id, title, household_id')
  if (insertError || !inserted) {
    throw new Error(`insert tasks: ${insertError?.message}`)
  }
  const idOf = (title: string) => inserted.find(t => t.title === title)?.id ?? ''

  // Completions: history of repeating tasks, and the completed one-time tasks (Done tab).
  // Written with the service role (clients can only complete through the RPC); kept consistent with the task row.
  const completions: Database['public']['Tables']['task_completions']['Insert'][] = []
  for (const t of TASKS) {
    const taskId = idOf(t.title)
    for (const [ago, late, who] of t.history ?? []) {
      completions.push({
        task_id: taskId,
        household_id: householdId,
        completed_by: userId(who),
        completed_at: daysAgo(ago),
        due_date_at_completion: date(-ago - late),
      })
    }
    if (t.doneDaysAgo !== undefined) {
      completions.push({
        task_id: taskId,
        household_id: householdId,
        completed_by: userId(t.assignee) ?? dana.id,
        completed_at: daysAgo(t.doneDaysAgo, 18),
        due_date_at_completion: t.due === null ? null : date(t.due),
      })
    }
  }
  const { error: completionError } = await admin.from('task_completions').insert(completions)
  if (completionError) {
    throw new Error(`insert completions: ${completionError.message}`)
  }
  for (const t of TASKS) {
    if (t.history?.length) {
      const latest = Math.min(...t.history.map(([ago]) => ago))
      await admin.from('tasks').update({ last_completed_at: daysAgo(latest) }).eq('id', idOf(t.title))
    }
    if (t.doneDaysAgo !== undefined) {
      await admin.from('tasks').update({ completed_at: daysAgo(t.doneDaysAgo, 18) }).eq('id', idOf(t.title))
    }
  }

  const open = TASKS.filter(t => t.doneDaysAgo === undefined).length
  console.log(`Demo ready in "Our home" (${TIMEZONE}): ${open} open tasks, ${TASKS.length - open} done, ${completions.length} completions.`)
  console.log(`Log in as ${DANA.email} (Dana) or ${NOA.email} (Noa), password "${PASSWORD}".`)
}

await main()
