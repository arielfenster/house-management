// Helpers for RLS integration tests. They run against the LOCAL Supabase stack
// (`npm run db:start`) with real JWT-scoped clients: every user signs in and queries
// through PostgREST exactly like the browser does, so RLS applies.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';

export type Db = SupabaseClient<Database>;

interface TestEnv {
	url: string;
	publishableKey: string;
	secretKey: string;
}

let cachedEnv: TestEnv | undefined;

/** SUPABASE_URL / SUPABASE_KEY / SUPABASE_SECRET_KEY from the environment or .env, else from `supabase status`. */
export function getEnv(): TestEnv {
	if (cachedEnv) return cachedEnv;
	if (existsSync('.env')) process.loadEnvFile('.env');
	const { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SECRET_KEY } = process.env;
	if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_SECRET_KEY) {
		cachedEnv = { url: SUPABASE_URL, publishableKey: SUPABASE_KEY, secretKey: SUPABASE_SECRET_KEY };
		return cachedEnv;
	}
	let out: string;
	try {
		out = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		});
	} catch {
		throw new Error('Local Supabase is not running. Start it with `npm run db:start`.');
	}
	const values = Object.fromEntries(
		out
			.split('\n')
			.map((line) => line.match(/^([A-Z_]+)="?([^"]*)"?$/))
			.filter((m) => m !== null)
			.map((m) => [m[1], m[2]]),
	);
	cachedEnv = {
		url: values.API_URL!,
		publishableKey: values.PUBLISHABLE_KEY!,
		secretKey: values.SECRET_KEY!,
	};
	return cachedEnv;
}

const clientOptions = {
	auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

/** Service-role client: bypasses RLS. Only for test setup, assertions about stored state, and cleanup. */
export function adminClient(): Db {
	const env = getEnv();
	return createClient<Database>(env.url, env.secretKey, clientOptions);
}

/** Unauthenticated client (publishable key only). */
export function anonClient(): Db {
	const env = getEnv();
	return createClient<Database>(env.url, env.publishableKey, clientOptions);
}

export interface TestUser {
	id: string;
	email: string;
	displayName: string;
	client: Db;
}

const createdUserIds: string[] = [];
const createdHouseholdIds: string[] = [];

/** Creates a confirmed user and returns a client signed in as that user (JWT-scoped). */
export async function createUser(label: string, displayName = label): Promise<TestUser> {
	const email = `${label.toLowerCase()}-${randomUUID().slice(0, 8)}@rls-test.example.com`;
	const password = `pw-${randomUUID()}`;
	const created = await adminClient().auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { display_name: displayName },
	});
	if (created.error || !created.data.user)
		throw new Error(`createUser failed: ${created.error?.message}`);
	createdUserIds.push(created.data.user.id);

	const client = anonClient();
	const signedIn = await client.auth.signInWithPassword({ email, password });
	if (signedIn.error) throw new Error(`sign-in failed: ${signedIn.error.message}`);
	return { id: created.data.user.id, email, displayName, client };
}

/** Creates a household through the real RPC, as `user`. */
export async function createHousehold(
	user: TestUser,
	name = 'Test home',
	timezone = 'UTC',
): Promise<string> {
	const { data, error } = await user.client.rpc('create_household', {
		p_name: name,
		p_timezone: timezone,
	});
	if (error || !data) throw new Error(`create_household failed: ${error?.message}`);
	createdHouseholdIds.push(data);
	return data;
}

export async function inviteCodeOf(householdId: string): Promise<string> {
	const { data, error } = await adminClient()
		.from('households')
		.select('invite_code')
		.eq('id', householdId)
		.single();
	if (error) throw new Error(`inviteCodeOf failed: ${error.message}`);
	return data.invite_code;
}

export interface World {
	a1: TestUser;
	a2: TestUser;
	b1: TestUser;
	householdA: string;
	householdB: string;
	codeA: string;
}

/** The standard fixture from docs/04-AUTHORIZATION.md: A1 + A2 in household A, B1 alone in household B. */
export async function createWorld(): Promise<World> {
	const [a1, a2, b1] = await Promise.all([createUser('a1'), createUser('a2'), createUser('b1')]);
	const householdA = await createHousehold(a1, 'Household A');
	const householdB = await createHousehold(b1, 'Household B');
	const codeA = await inviteCodeOf(householdA);
	const { error } = await a2.client.rpc('join_household', { p_invite_code: codeA });
	if (error) throw new Error(`join_household failed: ${error.message}`);
	return { a1, a2, b1, householdA, householdB, codeA };
}

/** Removes everything created through these helpers (households cascade to members and notes). */
export async function cleanup(): Promise<void> {
	const admin = adminClient();
	if (createdHouseholdIds.length)
		await admin.from('households').delete().in('id', createdHouseholdIds.splice(0));
	for (const id of createdUserIds.splice(0)) await admin.auth.admin.deleteUser(id);
}
