-- SHOP-009: realtime sync for the shopping list (features/SHOPPING.md §9, docs/01-TECH-STACK.md: Realtime only for
-- shopping). Clients subscribe to Postgres Changes on these tables, filtered by list_id.
--
-- Authorization: Realtime checks each subscriber's RLS (members only) for inserts and updates. Delete events cannot be
-- checked against a row that is gone; with the default replica identity they carry only the primary key, so a
-- subscriber outside the household learns at most the random uuid of a deleted row. Accepted (no content leaks).

alter publication supabase_realtime add table public.shopping_sections, public.shopping_items;
