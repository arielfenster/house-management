import * as v from 'valibot'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { completeTaskBodySchema, taskIdSchema } from '#shared/validation/task'
import type { Database } from '~~/types/database.types'

/**
 * POST /api/tasks/:id/complete — complete a task as the signed-in user (docs/02-ARCHITECTURE.md).
 * A server route only because the next due date of a recurring task is computed in TypeScript
 * (shared/recurrence.ts) in the household timezone. Runs with the user's JWT: RLS and the RPC's visibility
 * check decide (no service role). Undo is the `uncomplete_task` RPC, called directly by the client.
 *
 * Body: { expectedDueDate?: 'YYYY-MM-DD' | null }  →  200 { completionId, dueDate, completedAt, lastCompletedAt }
 * Errors: 400 invalid input, 401 signed out, 404 task not visible, 409 already completed / due date changed.
 */
export default defineEventHandler(async (event) => {
  const id = v.safeParse(taskIdSchema, getRouterParam(event, 'id'))
  if (!id.success) {
    throw createError({ statusCode: 400, statusMessage: 'invalid_task_id' })
  }
  const body = await readValidatedBody(event, raw => v.parse(completeTaskBodySchema, raw ?? {}))

  if (!(await serverSupabaseUser(event))) {
    throw createError({ statusCode: 401, statusMessage: 'not_authenticated' })
  }
  const client = await serverSupabaseClient<Database>(event)
  const result = await completeTask(client, id.output, body.expectedDueDate)
  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.code })
  }
  return {
    completionId: result.completionId,
    dueDate: result.dueDate,
    completedAt: result.completedAt,
    lastCompletedAt: result.lastCompletedAt,
  }
})
