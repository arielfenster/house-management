import * as v from 'valibot'
import { SHOPPING_ITEM_NAME_MAX, SHOPPING_SECTION_NAME_MAX, cleanItemName } from '../shopping-paste'

// Section names: 1–50 characters (shopping_sections check, supabase/migrations/*_shopping.sql).
export const shoppingSectionNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('Enter a name.'),
  v.maxLength(SHOPPING_SECTION_NAME_MAX, `Use at most ${SHOPPING_SECTION_NAME_MAX} characters.`),
)

/**
 * Validates a section name for create (`exceptId` null) or rename. The database allows duplicates; the UI does
 * not, ignoring case, because two "Produce" headings would only confuse.
 * Returns the trimmed name, or an error message.
 */
export function checkSectionName(
  input: string,
  sections: readonly { id: string, name: string }[],
  exceptId: string | null = null,
): { ok: true, name: string } | { ok: false, error: string } {
  const parsed = v.safeParse(shoppingSectionNameSchema, input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.issues[0].message,
    }
  }
  const lower = parsed.output.toLocaleLowerCase()
  if (sections.some(s => s.id !== exceptId && s.name.toLocaleLowerCase() === lower)) {
    return {
      ok: false,
      error: `There is already a “${parsed.output}” section.`,
    }
  }
  return {
    ok: true,
    name: parsed.output,
  }
}

// Item names: 1–200 characters (shopping_items check). Editing cleans the name like typing does (whitespace
// collapsed, list markers dropped); duplicates are fine.
export const shoppingItemNameSchema = v.pipe(
  v.string(),
  v.transform(cleanItemName),
  v.nonEmpty('Enter a name.'),
  v.maxLength(SHOPPING_ITEM_NAME_MAX, `Use at most ${SHOPPING_ITEM_NAME_MAX} characters.`),
)
