-- FOUNDATION-004: profiles (+ signup trigger), households, household_members, private helpers.
-- Design: docs/03-DATABASE-SCHEMA.md, docs/04-AUTHORIZATION.md (decisions D1, D2, D14).
-- Households and memberships are created only by security-definer RPCs (FOUNDATION-005);
-- clients get no insert policies on them.

-- ---------------------------------------------------------------------------
-- Private schema: helpers used by RLS policies. Not exposed through the API
-- (PostgREST exposes only `public`), so these are not callable as /rpc endpoints.
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) > 0),
  reminder_days_before int not null default 1 check (reminder_days_before between 0 and 60),
  reminder_hour int not null default 9 check (reminder_hour between 0 and 23),
  notifications_enabled boolean not null default true
);

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  timezone text not null default 'UTC',
  -- 32 hex chars of a random v4 uuid (122 random bits); rotatable later via RPC.
  invite_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- household_members: one household per user for now (D2): unique (user_id).
-- No role column: all members are equal.
-- ---------------------------------------------------------------------------
create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so they can read household_members
-- without recursing into its own RLS policies).
-- ---------------------------------------------------------------------------
create function private.is_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = hid
      and hm.user_id = (select auth.uid())
  );
$$;

-- True when `uid` is the caller or belongs to the caller's household.
create function private.is_self_or_co_member(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select uid = (select auth.uid())
    or exists (
      select 1
      from public.household_members me
      join public.household_members other on other.household_id = me.household_id
      where me.user_id = (select auth.uid())
        and other.user_id = uid
    );
$$;

revoke all on function private.is_member(uuid) from public, anon;
revoke all on function private.is_self_or_co_member(uuid) from public, anon;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_self_or_co_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Signup trigger: every auth user gets a profile (D1).
-- Name from signup metadata (`display_name`), else the email's local part.
-- ---------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
      'Member'
    )
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Privileges: least privilege on top of RLS. Supabase grants broad table
-- privileges to anon/authenticated by default; narrow them explicitly.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.households, public.household_members from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, reminder_days_before, reminder_hour, notifications_enabled)
  on public.profiles to authenticated;

grant select on public.households to authenticated;
grant update (name, timezone) on public.households to authenticated; -- invite_code is not client-writable

grant select, delete on public.household_members to authenticated; -- delete = leave

-- ---------------------------------------------------------------------------
-- Row level security (docs/04-AUTHORIZATION.md policy table)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- profiles: self or co-member can read; only self can update; insert via trigger; delete via cascade.
create policy profiles_select on public.profiles
  for select to authenticated
  using (private.is_self_or_co_member(id));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- households: members read/update; insert via RPC only; no delete in v1.
create policy households_select on public.households
  for select to authenticated
  using (private.is_member(id));

create policy households_update on public.households
  for update to authenticated
  using (private.is_member(id))
  with check (private.is_member(id));

-- household_members: members of the household read; a user may remove only themselves (leave);
-- insert via RPC only; no update.
create policy household_members_select on public.household_members
  for select to authenticated
  using (private.is_member(household_id));

create policy household_members_delete on public.household_members
  for delete to authenticated
  using (user_id = (select auth.uid()));
