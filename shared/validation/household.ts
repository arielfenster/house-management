import * as v from 'valibot'
import { ROUTES } from '../routes'

// Keep in sync with create_household / join_household (supabase/migrations/*_rpc_create_join_household.sql).
export const HOUSEHOLD_NAME_MAX_LENGTH = 100
export const INVITE_CODE_MIN_LENGTH = 12

export const createHouseholdSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Enter a household name.'),
    v.maxLength(HOUSEHOLD_NAME_MAX_LENGTH, `Use at most ${HOUSEHOLD_NAME_MAX_LENGTH} characters.`),
  ),
  timezone: v.pipe(v.string(), v.trim(), v.nonEmpty('Choose a timezone.')),
})

/**
 * Accepts the bare code or a whole pasted invite link (`https://…/join/<code>?x`), so people can
 * paste whatever they were sent. Returns the lower-cased code.
 */
export function parseInviteCode(input: string): string {
  let code = input.trim()
  const linkIndex = code.indexOf(ROUTES.join)
  if (linkIndex !== -1) {
    code = code.slice(linkIndex + ROUTES.join.length)
  }
  code = code.split(/[/?#]/, 1)[0] ?? ''
  try {
    code = decodeURIComponent(code)
  } catch {
    // Malformed escape: keep the raw text; validation rejects it.
  }
  return code.toLowerCase()
}

export const joinHouseholdSchema = v.object({
  inviteCode: v.pipe(
    v.string(),
    v.transform(parseInviteCode),
    v.nonEmpty('Enter the invite code.'),
    v.regex(/^[a-z0-9]+$/, 'That doesn’t look like an invite code.'),
    v.minLength(INVITE_CODE_MIN_LENGTH, 'That doesn’t look like an invite code.'),
  ),
})

export type CreateHouseholdInput = v.InferOutput<typeof createHouseholdSchema>
export type JoinHouseholdInput = v.InferOutput<typeof joinHouseholdSchema>

/** Error raised by create_household / join_household (stable message, docs/04-AUTHORIZATION.md). */
export type HouseholdRpcError =
  | 'not_authenticated'
  | 'already_in_household'
  | 'invalid_name'
  | 'invalid_timezone'
  | 'invalid_invite_code'

/** Maps an RPC error message to user-facing text. */
export function householdErrorMessage(message: string | undefined): string {
  switch (message as HouseholdRpcError | undefined) {
    case 'not_authenticated':
      return 'Your session expired. Log in again.'
    case 'already_in_household':
      return 'You are already in a household.'
    case 'invalid_name':
      return `Enter a household name (at most ${HOUSEHOLD_NAME_MAX_LENGTH} characters).`
    case 'invalid_timezone':
      return 'Choose a valid timezone.'
    case 'invalid_invite_code':
      return 'This invite code is not valid. Check it with the person who sent it.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
