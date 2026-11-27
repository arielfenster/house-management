-- TASKS-002: tasks, task_completions, complete_task / uncomplete_task RPCs.
-- Design: docs/03-DATABASE-SCHEMA.md (tasks, task_completions), docs/04-AUTHORIZATION.md, features/TASKS.md §9,
-- decisions D4 (stored due_date / last_completed_at), D8 (private tasks: self/unassigned only), D10 (recurrence
-- anchored on the completion date), D21 (completion RPCs are security definer).
--
-- Dates: `due_date` is a local calendar date in the household timezone (no time of day).
-- The next due date of a recurring task is computed in TypeScript (shared/recurrence.ts, TASKS-004) by the
-- server route POST /api/tasks/[id]/complete (TASKS-005) and passed to complete_task.

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- set null (not cascade): a deleted account must not take the household's shared tasks with it.
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  assigned_to uuid references auth.users (id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (length(description) <= 2000),
  kind text not null check (kind in ('one_time', 'recurring')),
  category_id uuid,
  room_id uuid,
  due_date date,
  recurrence_unit text check (recurrence_unit in ('day', 'week', 'month', 'year')),
  recurrence_interval int check (recurrence_interval between 1 and 999),
  remind_days_before int check (remind_days_before between 0 and 60),
  completed_at timestamptz,
  last_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Target of the composite foreign key from task_completions.
  unique (id, household_id),
  -- Categories and rooms must belong to the task's household; deleting one clears only the reference.
  foreign key (category_id, household_id)
    references public.task_categories (id, household_id) on delete set null (category_id),
  foreign key (room_id, household_id)
    references public.rooms (id, household_id) on delete set null (room_id),

  -- Recurring: unit, interval and a due date are required and it is never "completed" (it advances instead).
  -- One-time: no recurrence; due date optional.
  constraint tasks_kind_consistency check (
    (kind = 'recurring'
      and recurrence_unit is not null and recurrence_interval is not null
      and due_date is not null and completed_at is null)
    or (kind = 'one_time' and recurrence_unit is null and recurrence_interval is null)
  ),
  -- D8: a private task can only be unassigned or assigned to its creator.
  constraint tasks_private_assignment check (
    visibility = 'shared' or assigned_to is null or assigned_to = created_by
  )
);

-- Open tasks by due date (the list and the reminder job).
create index tasks_open_due_idx on public.tasks (household_id, due_date) where completed_at is null;
create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_category_id_idx on public.tasks (category_id);
create index tasks_room_id_idx on public.tasks (room_id);
create index tasks_created_by_idx on public.tasks (created_by);

-- ---------------------------------------------------------------------------
-- task_completions: history. Rows are written only by complete_task / uncomplete_task.
-- ---------------------------------------------------------------------------
create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  -- Denormalized for RLS and queries; kept consistent with the task by the composite foreign key.
  household_id uuid not null,
  completed_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz not null default now(),
  -- What the task was due when completed ("done 3 days late"); restored by undo.
  due_date_at_completion date,
  foreign key (task_id, household_id) references public.tasks (id, household_id) on delete cascade
);

create index task_completions_task_idx on public.task_completions (task_id, completed_at desc);
create index task_completions_completed_by_idx on public.task_completions (completed_by);

-- ---------------------------------------------------------------------------
-- Visibility rule (same as notes): private = creator only, while still a member; shared = any member.
-- Used by the RLS policies and the RPCs.
-- ---------------------------------------------------------------------------
create function private.task_visible(p_visibility text, p_created_by uuid, p_household_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (p_visibility = 'private' and p_created_by = (select auth.uid()) and private.is_member(p_household_id))
      or (p_visibility = 'shared' and private.is_member(p_household_id));
$$;

revoke all on function private.task_visible(text, uuid, uuid) from public, anon;
grant execute on function private.task_visible(text, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
-- Only the creator may change visibility (RLS cannot compare old and new rows).
create function private.tasks_guard_visibility_change()
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

-- The assignee must be a member of the task's household (a foreign key cannot express this).
create function private.tasks_check_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_to is not null and not exists (
    select 1 from public.household_members hm
    where hm.household_id = new.household_id and hm.user_id = new.assigned_to
  ) then
    raise exception 'assignee_not_member';
  end if;
  return new;
end;
$$;

-- A completed one-time task turned into a recurring one starts open again.
create function private.tasks_normalize_kind_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'recurring' and old.kind = 'one_time' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

-- A member who leaves the household is unassigned from its tasks (features/TASKS.md §10).
create function private.tasks_unassign_departed_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tasks
  set assigned_to = null
  where household_id = old.household_id and assigned_to = old.user_id;
  return old;
end;
$$;

revoke all on function private.tasks_guard_visibility_change() from public, anon, authenticated;
revoke all on function private.tasks_check_assignee() from public, anon, authenticated;
revoke all on function private.tasks_normalize_kind_change() from public, anon, authenticated;
revoke all on function private.tasks_unassign_departed_member() from public, anon, authenticated;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();

create trigger tasks_guard_visibility_change
  before update on public.tasks
  for each row execute function private.tasks_guard_visibility_change();

create trigger tasks_normalize_kind_change
  before update of kind on public.tasks
  for each row execute function private.tasks_normalize_kind_change();

create trigger tasks_check_assignee
  before insert or update of assigned_to on public.tasks
  for each row execute function private.tasks_check_assignee();

create trigger household_members_unassign_tasks
  after delete on public.household_members
  for each row execute function private.tasks_unassign_departed_member();

-- ---------------------------------------------------------------------------
-- RPCs (security definer, D21): they check visibility themselves, then write the completion row and the
-- task in one transaction. Clients have no insert/update/delete privileges on task_completions and cannot
-- write completed_at / last_completed_at, so history and task state cannot drift apart.
-- Errors (SQLSTATE P0001, stable messages): not_authenticated, task_not_found, already_completed,
-- stale_due_date, invalid_next_due_date, no_completion, not_completed, not_latest_completion.
-- ---------------------------------------------------------------------------

-- Complete a task as the caller.
-- One-time: sets completed_at. p_expected_due_date / p_next_due_date are ignored.
-- Recurring: p_expected_due_date must equal the current due date (the client saw it; a second, concurrent
--   completion of the same occurrence fails with stale_due_date). p_next_due_date (completion day + interval,
--   computed by shared/recurrence.ts) must be after today in the household timezone.
create function public.complete_task(
  p_task_id uuid,
  p_expected_due_date date default null,
  p_next_due_date date default null
)
returns table (completion_id uuid, due_date date, completed_at timestamptz, last_completed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_task public.tasks%rowtype;
  v_today date;
  v_now timestamptz := now();
  v_completion_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select t.* into v_task
  from public.tasks t
  where t.id = p_task_id and private.task_visible(t.visibility, t.created_by, t.household_id)
  for update;
  if not found then
    raise exception 'task_not_found';
  end if;

  if v_task.kind = 'one_time' then
    if v_task.completed_at is not null then
      raise exception 'already_completed';
    end if;
  else
    if v_task.due_date is distinct from p_expected_due_date then
      raise exception 'stale_due_date';
    end if;
    select (v_now at time zone h.timezone)::date into v_today
    from public.households h where h.id = v_task.household_id;
    if p_next_due_date is null or p_next_due_date <= v_today then
      raise exception 'invalid_next_due_date';
    end if;
  end if;

  insert into public.task_completions (task_id, household_id, completed_by, completed_at, due_date_at_completion)
  values (v_task.id, v_task.household_id, v_uid, v_now, v_task.due_date)
  returning id into v_completion_id;

  if v_task.kind = 'one_time' then
    update public.tasks t set completed_at = v_now where t.id = v_task.id;
  else
    update public.tasks t set due_date = p_next_due_date, last_completed_at = v_now where t.id = v_task.id;
  end if;

  return query
  select v_completion_id, t.due_date, t.completed_at, t.last_completed_at
  from public.tasks t where t.id = v_task.id;
end;
$$;

-- Undo the latest completion of a task (the undo toast, or un-ticking a completed one-time task).
-- p_completion_id, when given, must be the latest completion (so an undo never removes someone else's later
-- completion). Recurring: due_date goes back to what it was, last_completed_at to the previous completion.
create function public.uncomplete_task(p_task_id uuid, p_completion_id uuid default null)
returns table (due_date date, completed_at timestamptz, last_completed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_completion public.task_completions%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;

  select t.* into v_task
  from public.tasks t
  where t.id = p_task_id and private.task_visible(t.visibility, t.created_by, t.household_id)
  for update;
  if not found then
    raise exception 'task_not_found';
  end if;

  if v_task.kind = 'one_time' and v_task.completed_at is null then
    raise exception 'not_completed';
  end if;

  select c.* into v_completion
  from public.task_completions c
  where c.task_id = v_task.id
  order by c.completed_at desc, c.id desc
  limit 1;
  if not found then
    raise exception 'no_completion';
  end if;
  if p_completion_id is not null and v_completion.id <> p_completion_id then
    raise exception 'not_latest_completion';
  end if;

  delete from public.task_completions c where c.id = v_completion.id;

  if v_task.kind = 'one_time' then
    update public.tasks t set completed_at = null where t.id = v_task.id;
  else
    update public.tasks t
    set due_date = coalesce(v_completion.due_date_at_completion, t.due_date),
        last_completed_at = (
          select max(c.completed_at) from public.task_completions c where c.task_id = v_task.id
        )
    where t.id = v_task.id;
  end if;

  return query
  select t.due_date, t.completed_at, t.last_completed_at from public.tasks t where t.id = v_task.id;
end;
$$;

revoke all on function public.complete_task(uuid, date, date) from public, anon;
revoke all on function public.uncomplete_task(uuid, uuid) from public, anon;
grant execute on function public.complete_task(uuid, date, date) to authenticated;
grant execute on function public.uncomplete_task(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges: household_id and created_by are fixed at insert; completed_at / last_completed_at are
-- written only by the RPCs. Completions are read-only for clients.
-- ---------------------------------------------------------------------------
revoke all on public.tasks, public.task_completions from anon, authenticated;
grant select, delete on public.tasks to authenticated;
grant insert (
  household_id, created_by, visibility, assigned_to, title, description, kind, category_id, room_id,
  due_date, recurrence_unit, recurrence_interval, remind_days_before
) on public.tasks to authenticated;
grant update (
  visibility, assigned_to, title, description, kind, category_id, room_id,
  due_date, recurrence_unit, recurrence_interval, remind_days_before
) on public.tasks to authenticated;
grant select on public.task_completions to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;

create policy tasks_select on public.tasks
  for select to authenticated
  using (private.task_visible(visibility, created_by, household_id));

-- Insert as yourself, into your own household.
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (created_by = (select auth.uid()) and private.is_member(household_id));

-- Must see the row before and after the update (a member cannot make a shared task private and keep it,
-- or reach someone else's private task).
create policy tasks_update on public.tasks
  for update to authenticated
  using (private.task_visible(visibility, created_by, household_id))
  with check (private.task_visible(visibility, created_by, household_id));

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (private.task_visible(visibility, created_by, household_id));

-- History is visible to whoever can see the task (the subquery is filtered by tasks' own RLS).
create policy task_completions_select on public.task_completions
  for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
