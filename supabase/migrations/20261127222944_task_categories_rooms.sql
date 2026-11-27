-- TASKS-001: task_categories and rooms (docs/03-DATABASE-SCHEMA.md, D3).
-- Household-scoped lists with no system rows: defaults are copied in when a household is created
-- (seed hook in create_household) and backfilled here for households that already exist.
-- Same shape on purpose; separate tables because their future behaviour may differ.
-- RLS: any member may read and manage them (docs/04-AUTHORIZATION.md). Tests: TASKS-003.

create table public.task_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 50),
  created_at timestamptz not null default now(),
  -- Target of the composite foreign key from tasks (a task can only use its own household's values).
  unique (id, household_id)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 50),
  created_at timestamptz not null default now(),
  unique (id, household_id)
);

-- Names are unique per household, ignoring case ("Kitchen" = "kitchen").
create unique index task_categories_household_name_key on public.task_categories (household_id, lower(name));
create unique index rooms_household_name_key on public.rooms (household_id, lower(name));

-- ---------------------------------------------------------------------------
-- Defaults (D3). Called by create_household and by the backfill below.
-- ---------------------------------------------------------------------------
create function private.seed_task_lists(hid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.task_categories (household_id, name)
  select hid, name from unnest(array['Cleaning', 'Maintenance', 'General']) as name
  on conflict do nothing;

  insert into public.rooms (household_id, name)
  select hid, name from unnest(array['Kitchen', 'Bathroom', 'Living room', 'Bedroom', 'Balcony']) as name
  on conflict do nothing;
$$;

revoke all on function private.seed_task_lists(uuid) from public, anon, authenticated;

-- Backfill households created before this migration (only those that have no values yet).
select private.seed_task_lists(h.id)
from public.households h
where not exists (select 1 from public.task_categories c where c.household_id = h.id)
  and not exists (select 1 from public.rooms r where r.household_id = h.id);

-- create_household: same as FOUNDATION-005 plus the seed hook.
create or replace function public.create_household(p_name text, p_timezone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_tz text := btrim(coalesce(p_timezone, ''));
  v_household_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_name = '' or length(v_name) > 100 then
    raise exception 'invalid_name';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    raise exception 'invalid_timezone';
  end if;
  if exists (select 1 from public.household_members where user_id = v_uid) then
    raise exception 'already_in_household';
  end if;

  insert into public.households (name, timezone)
  values (v_name, v_tz)
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id)
  values (v_household_id, v_uid);

  -- SEED HOOK: defaults for this household. Later phases add file groups and the shopping list here.
  perform private.seed_task_lists(v_household_id);

  return v_household_id;
exception
  when unique_violation then
    -- concurrent create/join by the same user hit unique (user_id)
    raise exception 'already_in_household';
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: household_id is fixed at insert; only the name can change.
-- ---------------------------------------------------------------------------
revoke all on public.task_categories, public.rooms from anon, authenticated;
grant select, delete on public.task_categories, public.rooms to authenticated;
grant insert (household_id, name) on public.task_categories, public.rooms to authenticated;
grant update (name) on public.task_categories, public.rooms to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: members only, all operations.
-- ---------------------------------------------------------------------------
alter table public.task_categories enable row level security;
alter table public.rooms enable row level security;

create policy task_categories_select on public.task_categories
  for select to authenticated using (private.is_member(household_id));
create policy task_categories_insert on public.task_categories
  for insert to authenticated with check (private.is_member(household_id));
create policy task_categories_update on public.task_categories
  for update to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id));
create policy task_categories_delete on public.task_categories
  for delete to authenticated using (private.is_member(household_id));

create policy rooms_select on public.rooms
  for select to authenticated using (private.is_member(household_id));
create policy rooms_insert on public.rooms
  for insert to authenticated with check (private.is_member(household_id));
create policy rooms_update on public.rooms
  for update to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id));
create policy rooms_delete on public.rooms
  for delete to authenticated using (private.is_member(household_id));
