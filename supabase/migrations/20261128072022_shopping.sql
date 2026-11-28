-- SHOP-001: shopping_lists, shopping_sections, shopping_items (docs/03-DATABASE-SCHEMA.md, features/SHOPPING.md, D16).
--
-- One list per household is created by create_household (seed hook) and backfilled here; unique(household_id)
-- is deliberately not enforced so more lists stay possible later.
-- household_id is denormalized onto sections and items for RLS; composite foreign keys keep it equal to the
-- list's household, and keep an item's section inside the item's own list.
-- Ordering: fractional `position` (midpoint between neighbours, renormalized when gaps get tiny; shared/, SHOP-003).
-- Concurrency: last-write-wins per row; a reorder writes only the moved row.
-- Clients may supply `id` on insert so optimistic rows keep their id and realtime echoes can be matched (SHOP-009).
-- RLS: any member, all operations (docs/04-AUTHORIZATION.md). Tests: SHOP-002.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null default 'Shopping' check (length(btrim(name)) between 1 and 50),
  created_at timestamptz not null default now(),
  -- Target of the composite foreign keys from sections and items.
  unique (id, household_id)
);

create table public.shopping_sections (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null,
  household_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 50),
  position double precision not null,
  created_at timestamptz not null default now(),
  foreign key (list_id, household_id) references public.shopping_lists (id, household_id) on delete cascade,
  -- Target of the composite foreign key from items (an item's section must be in the item's list).
  unique (id, list_id)
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null,
  -- null = the implicit top area above the first section.
  section_id uuid,
  household_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 200),
  checked boolean not null default false,
  position double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (list_id, household_id) references public.shopping_lists (id, household_id) on delete cascade,
  -- D16: deleting a section deletes its items (the UI offers undo). MATCH SIMPLE: a null section_id is not checked.
  foreign key (section_id, list_id) references public.shopping_sections (id, list_id) on delete cascade
);

create index shopping_lists_household_idx on public.shopping_lists (household_id);
create index shopping_sections_list_position_idx on public.shopping_sections (list_id, position);
-- Rendering order, and the lookup behind the section foreign key's cascade.
create index shopping_items_list_section_position_idx on public.shopping_items (list_id, section_id, position);

create trigger shopping_items_set_updated_at
  before update on public.shopping_items
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Default list. Called by create_household and by the backfill below.
-- ---------------------------------------------------------------------------
create function private.seed_shopping_list(hid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.shopping_lists (household_id)
  select hid
  where not exists (select 1 from public.shopping_lists l where l.household_id = hid);
$$;

revoke all on function private.seed_shopping_list(uuid) from public, anon, authenticated;

-- Backfill households created before this migration.
select private.seed_shopping_list(h.id) from public.households h;

-- create_household: same as TASKS-001 plus the shopping list.
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

  -- SEED HOOK: defaults for this household. A later phase adds file groups here.
  perform private.seed_task_lists(v_household_id);
  perform private.seed_shopping_list(v_household_id);

  return v_household_id;
exception
  when unique_violation then
    -- concurrent create/join by the same user hit unique (user_id)
    raise exception 'already_in_household';
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: household_id and list_id are fixed at insert.
-- Lists: no client insert/delete in v1 (one list, created by the RPC; deleting it would lose everything).
-- ---------------------------------------------------------------------------
revoke all on public.shopping_lists, public.shopping_sections, public.shopping_items from anon, authenticated;

grant select on public.shopping_lists to authenticated;
grant update (name) on public.shopping_lists to authenticated;

grant select, delete on public.shopping_sections, public.shopping_items to authenticated;
grant insert (id, list_id, household_id, name, position) on public.shopping_sections to authenticated;
grant update (name, position) on public.shopping_sections to authenticated;
grant insert (id, list_id, household_id, section_id, name, checked, position) on public.shopping_items to authenticated;
grant update (section_id, name, checked, position) on public.shopping_items to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: members only.
-- ---------------------------------------------------------------------------
alter table public.shopping_lists enable row level security;
alter table public.shopping_sections enable row level security;
alter table public.shopping_items enable row level security;

create policy shopping_lists_select on public.shopping_lists
  for select to authenticated using (private.is_member(household_id));
create policy shopping_lists_update on public.shopping_lists
  for update to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id));

create policy shopping_sections_select on public.shopping_sections
  for select to authenticated using (private.is_member(household_id));
create policy shopping_sections_insert on public.shopping_sections
  for insert to authenticated with check (private.is_member(household_id));
create policy shopping_sections_update on public.shopping_sections
  for update to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id));
create policy shopping_sections_delete on public.shopping_sections
  for delete to authenticated using (private.is_member(household_id));

create policy shopping_items_select on public.shopping_items
  for select to authenticated using (private.is_member(household_id));
create policy shopping_items_insert on public.shopping_items
  for insert to authenticated with check (private.is_member(household_id));
create policy shopping_items_update on public.shopping_items
  for update to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id));
create policy shopping_items_delete on public.shopping_items
  for delete to authenticated using (private.is_member(household_id));
