/**
 * Fractional ordering for shopping sections and items (features/SHOPPING.md §9, docs/03-DATABASE-SCHEMA.md).
 *
 * Every row has a `position` (double precision). Moving or inserting a row writes only that row's position: the
 * midpoint of its new neighbours, or one STEP past the end. When the gap between neighbours drops below MIN_GAP
 * (or two rows share a position after concurrent inserts) the whole group is renumbered 1, 2, 3… first.
 * A "group" is the sections of one list, or the items of one section (null section = the top area).
 */

export const POSITION_STEP = 1
export const MIN_GAP = 1e-6

export interface Positioned {
  id: string
  position: number
}

export interface PositionUpdate {
  id: string
  position: number
}

/** Sort order: by position, ties broken by id so every client shows the same order. */
export function comparePositioned(a: Positioned, b: Positioned): number {
  if (a.position !== b.position) {
    return a.position - b.position
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function sortByPosition<T extends Positioned>(rows: readonly T[]): T[] {
  return [...rows].sort(comparePositioned)
}

/** Position between two neighbours; null = no neighbour on that side. Does not check the gap (see `hasRoom`). */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) {
    return POSITION_STEP
  }
  if (before === null) {
    return after! - POSITION_STEP
  }
  if (after === null) {
    return before + POSITION_STEP
  }
  return before + (after - before) / 2
}

/** Whether a new position fits between the neighbours without renumbering. */
export function hasRoom(before: number | null, after: number | null): boolean {
  if (before === null || after === null) {
    return true
  }
  return after - before >= MIN_GAP
}

/** Position for a new row appended after `rows` (any order). */
export function positionAtEnd(rows: readonly Positioned[]): number {
  if (rows.length === 0) {
    return POSITION_STEP
  }
  return Math.max(...rows.map(r => r.position)) + POSITION_STEP
}

/** Renumbers rows (already in display order) to STEP, 2·STEP, …; returns only the rows whose position changes. */
export function rebalance(ordered: readonly Positioned[]): PositionUpdate[] {
  const updates: PositionUpdate[] = []
  ordered.forEach((row, i) => {
    const position = (i + 1) * POSITION_STEP
    if (row.position !== position) {
      updates.push({
        id: row.id,
        position,
      })
    }
  })
  return updates
}

/**
 * Moves (or inserts) row `id` to `index` within `group`, the rows of the target group in display order.
 * `group` may contain the moved row (reorder within a group) or not (move from another group / new row).
 * Returns the position writes to make: normally just the moved row; the whole group when it had to be renumbered.
 */
export function planMove(group: readonly Positioned[], id: string, index: number): PositionUpdate[] {
  const others = group.filter(r => r.id !== id)
  const at = Math.max(0, Math.min(index, others.length))
  const before = at > 0 ? others[at - 1]!.position : null
  const after = at < others.length ? others[at]!.position : null

  if (hasRoom(before, after)) {
    const current = group.find(r => r.id === id)
    const position = positionBetween(before, after)
    if (current && current.position === position) {
      return []
    }
    return [
      {
        id,
        position,
      },
    ]
  }

  const reordered: Positioned[] = [...others]
  reordered.splice(at, 0, {
    id,
    position: Number.NaN,
  })
  return rebalance(reordered)
}

/** Applies position updates to rows (returns new objects for changed rows, the same objects otherwise). */
export function applyPositions<T extends Positioned>(rows: readonly T[], updates: readonly PositionUpdate[]): T[] {
  const byId = new Map(updates.map(u => [u.id, u.position]))
  return rows.map((row) => {
    const position = byId.get(row.id)
    if (position === undefined) {
      return row
    }
    return {
      ...row,
      position,
    }
  })
}
