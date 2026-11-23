interface MembershipState {
	userId: string;
	householdId: string | null;
}

/**
 * The signed-in user's household membership, cached per user for routing decisions.
 * Routing only: authorization is always enforced by RLS.
 */
export function useMembership() {
	const supabase = useSupabaseClient();
	const state = useState<MembershipState | null>('membership', () => null);

	async function load(userId: string): Promise<string | null> {
		if (state.value?.userId === userId) {
			return state.value.householdId;
		}
		const { data, error } = await supabase
			.from('household_members')
			.select('household_id')
			.eq('user_id', userId)
			.maybeSingle();
		if (error) {
			throw createError({ statusCode: 500, statusMessage: 'Could not load your household.' });
		}
		state.value = { userId, householdId: data?.household_id ?? null };
		return state.value.householdId;
	}

	/** Call after creating/joining/leaving a household so the next navigation re-checks. */
	function reset() {
		state.value = null;
	}

	return {
		membership: readonly(state),
		load,
		reset,
	};
}
