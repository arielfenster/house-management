-- FOUNDATION-006: notes table + RLS (private/shared). Foundation only, no UI yet.
-- Proves the private/shared pattern that `tasks` reuses in Phase 1 (docs/03, docs/04, D8, D9, D15).
--
-- Visibility rules:
--   private: only its creator (and only while the creator is still a household member)
--   shared:  any member of the household
-- Assignment/other columns never grant access.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_household_id_idx on public.notes (household_id);
create index notes_created_by_idx on public.notes (created_by);

-- ---------------------------------------------------------------------------
-- Triggers: maintain updated_at; only the creator may change visibility.
-- RLS cannot compare old and new rows, so the visibility rule lives here.
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.notes_guard_visibility_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visibility is distinct from old.visibility
     and old.created_by is distinct from (select auth.uid()) then
    raise exception 'only_creator_can_change_visibility';
  end if;
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.notes_guard_visibility_change() from public, anon, authenticated;

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function private.set_updated_at();

create trigger notes_guard_visibility_change
  before update on public.notes
  for each row execute function private.notes_guard_visibility_change();

-- ---------------------------------------------------------------------------
-- Privileges: household_id and created_by are fixed at insert (not updatable).
-- ---------------------------------------------------------------------------
revoke all on public.notes from anon, authenticated;
grant select, delete on public.notes to authenticated;
grant insert (household_id, created_by, visibility, title, content) on public.notes to authenticated;
grant update (visibility, title, content) on public.notes to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.notes enable row level security;

-- Read / update-target / delete-target rule: visible rows only.
create policy notes_select on public.notes
  for select to authenticated
  using (
    (visibility = 'private' and created_by = (select auth.uid()) and private.is_member(household_id))
    or (visibility = 'shared' and private.is_member(household_id))
  );

-- Insert: as yourself, into a household you belong to.
create policy notes_insert on public.notes
  for insert to authenticated
  with check (created_by = (select auth.uid()) and private.is_member(household_id));

-- Update: you must be able to see the row before and after (so a member can never turn a
-- shared note into a private one they cannot reach, or hijack a private one).
create policy notes_update on public.notes
  for update to authenticated
  using (
    (visibility = 'private' and created_by = (select auth.uid()) and private.is_member(household_id))
    or (visibility = 'shared' and private.is_member(household_id))
  )
  with check (
    (visibility = 'private' and created_by = (select auth.uid()) and private.is_member(household_id))
    or (visibility = 'shared' and private.is_member(household_id))
  );

-- Delete: same visibility as update.
create policy notes_delete on public.notes
  for delete to authenticated
  using (
    (visibility = 'private' and created_by = (select auth.uid()) and private.is_member(household_id))
    or (visibility = 'shared' and private.is_member(household_id))
  );
