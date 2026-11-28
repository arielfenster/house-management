/**
 * Turning typed or pasted text into shopping item names (features/SHOPPING.md §5, §10).
 * One item per non-empty line. List markers copied from notes or chat apps ("- ", "• ", "1. ", "[ ] ") are
 * dropped, whitespace is collapsed, and names are cut to the database limit.
 */

/** Same bound as the `shopping_items.name` check constraint. */
export const SHOPPING_ITEM_NAME_MAX = 200
/** Same bound as the `shopping_sections.name` check constraint. */
export const SHOPPING_SECTION_NAME_MAX = 50

// Bullets, numbering ("1." / "1)" followed by a space) and checkboxes, possibly combined: "- [x] Milk".
const LIST_MARKER = /^(?:[-*•◦▪·–—](?:\s+|$)|\d{1,3}[.)](?:\s+|$)|\[[ xX✓✔]?\]\s*|[☐☑☒✓✔]\s*)+/u

/** Cleans one line: trims, drops list markers, collapses whitespace, cuts to the limit. May return ''. */
export function cleanItemName(line: string): string {
  const name = line.replace(/\s+/g, ' ').trim().replace(LIST_MARKER, '').trim()
  return Array.from(name).slice(0, SHOPPING_ITEM_NAME_MAX).join('').trim()
}

/** Item names from text, one per non-empty line, in order. Duplicates are kept (the user may want them). */
export function parseItemLines(text: string): string[] {
  return text
    .split(/\r\n|\r|\n|\u2028|\u2029/)
    .map(cleanItemName)
    .filter(name => name !== '')
}

/** Whether pasted text should become several items instead of being inserted into the input. */
export function isMultiItemPaste(text: string): boolean {
  return parseItemLines(text).length > 1
}
