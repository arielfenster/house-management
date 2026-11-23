-- FOUNDATION-005: RPCs create_household and join_household (docs/04-AUTHORIZATION.md, D2, D14).
--
-- These are the ONLY way rows enter households / household_members (no insert policies exist).
-- security definer: they bypass RLS and enforce the rules themselves.
--
-- Errors are raised with a stable machine-readable message (SQLSTATE P0001); the app maps
-- them to UI text: not_authenticated, already_in_household, invalid_name,
-- invalid_timezone, invalid_invite_code.
--
-- Later phases `create or replace` create_household to seed categories, rooms, file
-- groups and the shopping list inside the same transaction (see the marked hook below).
--
-- No attempt-counter table for join_household: invite codes are 32 hex chars of a random
-- v4 uuid (122 random bits), so guessing is infeasible; a failed attempt would also be
-- rolled back with the raising transaction, making a counter ineffective.

create function public.create_household(p_name text, p_timezone text)
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

  -- SEED HOOK: later phases insert default task categories, rooms, file groups and the
  -- shopping list for v_household_id here (create or replace this function).

  return v_household_id;
exception
  when unique_violation then
    -- concurrent create/join by the same user hit unique (user_id)
    raise exception 'already_in_household';
end;
$$;

create function public.join_household(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text := lower(btrim(coalesce(p_invite_code, '')));
  v_household_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.household_members where user_id = v_uid) then
    raise exception 'already_in_household';
  end if;

  -- Codes are >= 12 chars; reject short input without touching the table.
  if length(v_code) < 12 then
    raise exception 'invalid_invite_code';
  end if;

  select h.id into v_household_id
  from public.households h
  where h.invite_code = v_code;

  if v_household_id is null then
    raise exception 'invalid_invite_code';
  end if;

  insert into public.household_members (household_id, user_id)
  values (v_household_id, v_uid);

  return v_household_id;
exception
  when unique_violation then
    raise exception 'already_in_household';
end;
$$;

revoke all on function public.create_household(text, text) from public, anon;
revoke all on function public.join_household(text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
