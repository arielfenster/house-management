<script setup lang="ts">
import * as v from 'valibot';
import { toast } from 'vue-sonner';
import type { Household } from '~/composables/use-household';
import { APP_HOME, INVITE_CODE_QUERY } from '#shared/routes';
import { fieldErrors } from '#shared/validation/auth';
import {
	HOUSEHOLD_NAME_MAX_LENGTH,
	createHouseholdSchema,
	joinHouseholdSchema,
} from '#shared/validation/household';

definePageMeta({
	layout: false,
});

type Mode = 'create' | 'join';

const route = useRoute();
const { signOut } = useAuth();
const { createHousehold, joinHousehold, fetchHousehold } = useHousehold();

// Set by /join/<code> links.
const codeFromLink = route.query[INVITE_CODE_QUERY];
const prefilledCode = typeof codeFromLink === 'string' ? codeFromLink : '';

const mode = ref<Mode>(prefilledCode ? 'join' : 'create');
const createForm = reactive({ name: '', timezone: 'UTC' });
const joinForm = reactive({ inviteCode: prefilledCode });
const errors = ref<Record<string, string>>({});
const formError = ref('');
const pending = ref(false);
/** Set after creating: shows the invite step before entering the app. */
const created = ref<Household | null>(null);

useHead({
	title: () => (created.value ? 'Invite a member' : 'Set up your household'),
});

onMounted(() => {
	// The household timezone defaults to this device's (docs/03-DATABASE-SCHEMA.md: set at creation from the browser).
	createForm.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
});

function setMode(next: Mode) {
	mode.value = next;
	errors.value = {};
	formError.value = '';
}

async function handleFailure(message: string, alreadyMember: boolean) {
	if (alreadyMember) {
		// Joined or created in another tab: just go to the app.
		await navigateTo(APP_HOME);
		return;
	}
	formError.value = message;
}

async function submitCreate() {
	formError.value = '';
	const parsed = v.safeParse(createHouseholdSchema, createForm);
	if (!parsed.success) {
		errors.value = fieldErrors(parsed.issues);
		return;
	}
	errors.value = {};
	pending.value = true;
	const result = await createHousehold(parsed.output);
	if (!result.ok) {
		pending.value = false;
		await handleFailure(result.message, result.alreadyMember);
		return;
	}
	created.value = await fetchHousehold(result.householdId);
	pending.value = false;
	if (!created.value) {
		await navigateTo(APP_HOME);
	}
}

async function submitJoin() {
	formError.value = '';
	const parsed = v.safeParse(joinHouseholdSchema, joinForm);
	if (!parsed.success) {
		errors.value = fieldErrors(parsed.issues);
		return;
	}
	errors.value = {};
	pending.value = true;
	const result = await joinHousehold(parsed.output);
	pending.value = false;
	if (!result.ok) {
		await handleFailure(result.message, result.alreadyMember);
		return;
	}
	toast.success('You joined the household');
	await navigateTo(APP_HOME);
}
</script>

<template>
	<AuthCard :title="created ? 'Household created' : 'Set up your household'">
		<div v-if="created" class="space-y-6">
			<HouseholdInvite :household-name="created.name" :invite-code="created.inviteCode" />
			<Button class="w-full" @click="navigateTo(APP_HOME)"> Continue </Button>
		</div>

		<template v-else>
			<div
				class="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
				role="group"
				aria-label="Create or join"
			>
				<Button
					:variant="mode === 'create' ? 'outline' : 'ghost'"
					size="sm"
					:aria-pressed="mode === 'create'"
					@click="setMode('create')"
				>
					Create new
				</Button>
				<Button
					:variant="mode === 'join' ? 'outline' : 'ghost'"
					size="sm"
					:aria-pressed="mode === 'join'"
					@click="setMode('join')"
				>
					Join with code
				</Button>
			</div>

			<form v-if="mode === 'create'" class="space-y-4" novalidate @submit.prevent="submitCreate">
				<FormField
					id="household-name"
					v-model="createForm.name"
					label="Household name"
					placeholder="e.g. Our home"
					:maxlength="HOUSEHOLD_NAME_MAX_LENGTH"
					autofocus
					:error="errors.name"
				/>
				<HouseholdTimezoneSelect
					id="household-timezone"
					v-model="createForm.timezone"
					label="Timezone"
					:error="errors.timezone"
				/>
				<p v-if="formError" role="alert" class="text-sm text-destructive">
					{{ formError }}
				</p>
				<Button type="submit" class="w-full" :disabled="pending">
					{{ pending ? 'Creating…' : 'Create household' }}
				</Button>
			</form>

			<form v-else class="space-y-4" novalidate @submit.prevent="submitJoin">
				<FormField
					id="invite-code"
					v-model="joinForm.inviteCode"
					label="Invite code or link"
					placeholder="Paste the code or link you were sent"
					dir="ltr"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					autofocus
					:error="errors.inviteCode"
				/>
				<p v-if="formError" role="alert" class="text-sm text-destructive">
					{{ formError }}
				</p>
				<Button type="submit" class="w-full" :disabled="pending">
					{{ pending ? 'Joining…' : 'Join household' }}
				</Button>
			</form>
		</template>

		<template #footer>
			<button type="button" class="underline underline-offset-4" @click="signOut">Log out</button>
		</template>
	</AuthCard>
</template>
