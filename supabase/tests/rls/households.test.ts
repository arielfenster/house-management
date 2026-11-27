// docs/04-AUTHORIZATION.md test list: 7 (join rules), plus household lifecycle rules.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	adminClient,
	anonClient,
	cleanup,
	createHousehold,
	createUser,
	createWorld,
	type World,
} from '../helpers';

let w: World;
beforeAll(async () => {
	w = await createWorld();
});
afterAll(cleanup);

describe('create_household', () => {
	it('rejects anonymous callers', async () => {
		const { error } = await anonClient().rpc('create_household', {
			p_name: 'x',
			p_timezone: 'UTC',
		});
		expect(error).not.toBeNull();
	});

	it('validates name and timezone', async () => {
		const u = await createUser('v');
		expect(
			(await u.client.rpc('create_household', { p_name: '   ', p_timezone: 'UTC' })).error?.message,
		).toBe('invalid_name');
		expect(
			(await u.client.rpc('create_household', { p_name: 'Home', p_timezone: 'Mars/Base' })).error
				?.message,
		).toBe('invalid_timezone');
	});

	it('creates household + membership and trims the name', async () => {
		const u = await createUser('creator');
		const id = await createHousehold(u, '  Our home  ', 'Asia/Jerusalem');
		const { data } = await adminClient()
			.from('households')
			.select('name, timezone')
			.eq('id', id)
			.single();
		expect(data).toEqual({ name: 'Our home', timezone: 'Asia/Jerusalem' });
		const members = await adminClient()
			.from('household_members')
			.select('user_id')
			.eq('household_id', id);
		expect(members.data).toEqual([{ user_id: u.id }]);
	});

	it('seeds default task categories and rooms (TASKS-001), visible to the creator', async () => {
		const u = await createUser('seeded');
		const id = await createHousehold(u);
		const categories = await u.client.from('task_categories').select('name').eq('household_id', id).order('name');
		expect(categories.data?.map((c) => c.name)).toEqual(['Cleaning', 'General', 'Maintenance']);
		const rooms = await u.client.from('rooms').select('name').eq('household_id', id).order('name');
		expect(rooms.data?.map((r) => r.name)).toEqual(['Balcony', 'Bathroom', 'Bedroom', 'Kitchen', 'Living room']);
	});

	it('refuses a user who is already in a household', async () => {
		const { error } = await w.a1.client.rpc('create_household', {
			p_name: 'Second',
			p_timezone: 'UTC',
		});
		expect(error?.message).toBe('already_in_household');
	});
});

describe('join_household', () => {
	it('rejects anonymous callers', async () => {
		const { error } = await anonClient().rpc('join_household', { p_invite_code: w.codeA });
		expect(error).not.toBeNull();
	});

	it('fails with a bad or unknown code', async () => {
		const u = await createUser('j1');
		expect((await u.client.rpc('join_household', { p_invite_code: 'abc' })).error?.message).toBe(
			'invalid_invite_code',
		);
		expect(
			(await u.client.rpc('join_household', { p_invite_code: '0'.repeat(32) })).error?.message,
		).toBe('invalid_invite_code');
		expect((await u.client.rpc('join_household', { p_invite_code: '' })).error?.message).toBe(
			'invalid_invite_code',
		);
	});

	it('joins with a valid code (case/whitespace insensitive) and returns the household id', async () => {
		const u = await createUser('j2');
		const { data, error } = await u.client.rpc('join_household', {
			p_invite_code: `  ${w.codeA.toUpperCase()} `,
		});
		expect(error).toBeNull();
		expect(data).toBe(w.householdA);
		// now sees household A
		const seen = await u.client.from('households').select('id');
		expect(seen.data).toEqual([{ id: w.householdA }]);
	});

	it('refuses a user who is already in a household (cannot join another)', async () => {
		const codeB = (
			await adminClient().from('households').select('invite_code').eq('id', w.householdB).single()
		).data!.invite_code;
		const { error } = await w.a1.client.rpc('join_household', { p_invite_code: codeB });
		expect(error?.message).toBe('already_in_household');
		const again = await w.a2.client.rpc('join_household', { p_invite_code: w.codeA });
		expect(again.error?.message).toBe('already_in_household');
	});
});

describe('direct writes are blocked (RPC is the only way in)', () => {
	it('authenticated users cannot insert households', async () => {
		const u = await createUser('d1');
		const { error } = await u.client.from('households').insert({ name: 'sneaky' });
		expect(error?.code).toBe('42501');
	});

	it('authenticated users cannot insert memberships (even for themselves)', async () => {
		const u = await createUser('d2');
		const { error } = await u.client
			.from('household_members')
			.insert({ household_id: w.householdA, user_id: u.id });
		expect(error?.code).toBe('42501');
	});

	it('members cannot rewrite the invite code, but can rename the household', async () => {
		const bad = await w.a1.client
			.from('households')
			.update({ invite_code: 'hijacked' })
			.eq('id', w.householdA);
		expect(bad.error?.code).toBe('42501');
		const ok = await w.a2.client
			.from('households')
			.update({ name: 'Renamed by A2' })
			.eq('id', w.householdA)
			.select('name');
		expect(ok.data).toEqual([{ name: 'Renamed by A2' }]);
	});

	it('a member can leave; nobody can remove another member', async () => {
		const u = await createUser('leaver');
		await u.client.rpc('join_household', { p_invite_code: w.codeA });
		const others = await w.a1.client
			.from('household_members')
			.delete()
			.eq('user_id', u.id)
			.select();
		expect(others.data).toEqual([]);
		const left = await u.client.from('household_members').delete().eq('user_id', u.id).select();
		expect(left.data).toHaveLength(1);
		const seen = await u.client.from('households').select('id');
		expect(seen.data).toEqual([]);
	});
});
