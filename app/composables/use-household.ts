import type { CreateHouseholdInput, JoinHouseholdInput } from '#shared/validation/household'
import { householdErrorMessage } from '#shared/validation/household'

export interface Household {
  id: string
  name: string
  timezone: string
  inviteCode: string
}

type HouseholdResult =
  | { ok: true, householdId: string }
  | { ok: false, message: string, alreadyMember: boolean }

/** Household create/join (RPCs, docs/04-AUTHORIZATION.md) and reading the current household. */
export function useHousehold() {
  const supabase = useSupabaseClient()
  const membership = useMembership()

  function toResult(data: string | null, message: string | undefined): HouseholdResult {
    if (message || !data) {
      return {
        ok: false,
        message: householdErrorMessage(message),
        alreadyMember: message === 'already_in_household',
      }
    }
    // Membership changed: the next navigation must re-check it.
    membership.reset()
    return {
      ok: true,
      householdId: data,
    }
  }

  async function createHousehold(input: CreateHouseholdInput): Promise<HouseholdResult> {
    const { data, error } = await supabase.rpc('create_household', {
      p_name: input.name,
      p_timezone: input.timezone,
    })
    return toResult(data, error?.message)
  }

  async function joinHousehold(input: JoinHouseholdInput): Promise<HouseholdResult> {
    const { data, error } = await supabase.rpc('join_household', {
      p_invite_code: input.inviteCode,
    })
    return toResult(data, error?.message)
  }

  /** The household by id; RLS returns it only to members. */
  async function fetchHousehold(householdId: string): Promise<Household | null> {
    const { data, error } = await supabase
      .from('households')
      .select('id, name, timezone, invite_code')
      .eq('id', householdId)
      .maybeSingle()
    if (error || !data) {
      return null
    }
    return {
      id: data.id,
      name: data.name,
      timezone: data.timezone,
      inviteCode: data.invite_code,
    }
  }

  return {
    createHousehold,
    joinHousehold,
    fetchHousehold,
  }
}
