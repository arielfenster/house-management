-- Deleting a shopping section keeps its items: they move to the top area ("No section") instead of being deleted
-- (D24, replaces D16 for shopping). features/SHOPPING.md §10.
--
-- 1. A before-delete trigger appends the section's items to the end of the top area, in their order, so they do not
--    interleave with items already there. It runs as the deleting user: members may update these columns under RLS,
--    and the rows are in the same list (composite foreign keys). The updates also reach other clients via Realtime.
-- 2. The foreign key no longer cascades; it clears section_id as a backstop (the trigger has already done it).

create function private.shopping_sections_release_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_end double precision;
begin
  select coalesce(max(i.position), 0) into v_end
  from public.shopping_items i
  where i.list_id = old.list_id and i.section_id is null;

  update public.shopping_items i
  set section_id = null,
      position = v_end + moved.n
  from (
    select x.id, row_number() over (order by x.position, x.id) as n
    from public.shopping_items x
    where x.section_id = old.id
  ) as moved
  where i.id = moved.id;

  return old;
end;
$$;

revoke all on function private.shopping_sections_release_items() from public, anon, authenticated;

create trigger shopping_sections_release_items
  before delete on public.shopping_sections
  for each row execute function private.shopping_sections_release_items();

alter table public.shopping_items
  drop constraint shopping_items_section_id_list_id_fkey,
  add constraint shopping_items_section_id_list_id_fkey
    foreign key (section_id, list_id) references public.shopping_sections (id, list_id) on delete set null (section_id);
