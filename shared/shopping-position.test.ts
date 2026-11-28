import { describe, expect, it } from 'vitest'
import {
  MIN_GAP,
  POSITION_STEP,
  applyPositions,
  comparePositioned,
  hasRoom,
  planMove,
  positionAtEnd,
  positionBetween,
  rebalance,
  sortByPosition,
  type Positioned,
} from './shopping-position'

const rows = (...positions: number[]): Positioned[] => positions.map((position, i) => ({
  id: String.fromCharCode(97 + i),
  position,
}))

/** Display order (ids) after applying a plan. */
function orderAfter(group: Positioned[], updates: ReturnType<typeof planMove>, added?: Positioned): string[] {
  const all = added ? [...group, added] : group
  return sortByPosition(applyPositions(all, updates)).map(r => r.id)
}

describe('positionBetween', () => {
  it.each([
    [null, null, POSITION_STEP],
    [null, 5, 5 - POSITION_STEP],
    [5, null, 5 + POSITION_STEP],
    [1, 2, 1.5],
    [-3, -1, -2],
  ])('(%s, %s) = %s', (before, after, expected) => {
    expect(positionBetween(before, after)).toBe(expected)
  })

  it('keeps halving for a long time before running out of room', () => {
    let after = 2
    let steps = 0
    while (hasRoom(1, after)) {
      after = positionBetween(1, after)
      steps++
    }
    expect(steps).toBeGreaterThanOrEqual(19)
  })
})

describe('hasRoom', () => {
  it('is true at either end and for normal gaps', () => {
    expect(hasRoom(null, 1)).toBe(true)
    expect(hasRoom(1, null)).toBe(true)
    expect(hasRoom(1, 1 + 2 * MIN_GAP)).toBe(true)
  })

  it('is false for tiny gaps and equal positions', () => {
    expect(hasRoom(1, 1 + MIN_GAP / 2)).toBe(false)
    expect(hasRoom(3, 3)).toBe(false)
  })
})

describe('positionAtEnd', () => {
  it('starts at STEP and goes one STEP past the maximum, whatever the order', () => {
    expect(positionAtEnd([])).toBe(POSITION_STEP)
    expect(positionAtEnd(rows(3, 1.5, 7))).toBe(7 + POSITION_STEP)
    expect(positionAtEnd(rows(-4))).toBe(-4 + POSITION_STEP)
  })
})

describe('ordering', () => {
  it('sorts by position, ties by id', () => {
    const list = [
      { id: 'z', position: 1 },
      { id: 'b', position: 2 },
      { id: 'a', position: 2 },
      { id: 'c', position: 0.5 },
    ]
    expect(sortByPosition(list).map(r => r.id)).toEqual(['c', 'z', 'a', 'b'])
    expect(comparePositioned(list[0]!, list[0]!)).toBe(0)
  })

  it('does not mutate the input', () => {
    const list = rows(2, 1)
    sortByPosition(list)
    expect(list.map(r => r.id)).toEqual(['a', 'b'])
  })
})

describe('rebalance', () => {
  it('renumbers in order and returns only changed rows', () => {
    expect(rebalance(rows(1, 1.5, 1.75, 4))).toEqual([
      { id: 'b', position: 2 },
      { id: 'c', position: 3 },
    ])
  })

  it('returns nothing for an already even group', () => {
    expect(rebalance(rows(1, 2, 3))).toEqual([])
  })
})

describe('planMove', () => {
  it('writes only the moved row when there is room', () => {
    const group = rows(1, 2, 3)
    expect(planMove(group, 'c', 0)).toEqual([{ id: 'c', position: 0 }])
    expect(planMove(group, 'a', 2)).toEqual([{ id: 'a', position: 4 }])
    expect(planMove(group, 'c', 1)).toEqual([{ id: 'c', position: 1.5 }])
    expect(orderAfter(group, planMove(group, 'c', 1))).toEqual(['a', 'c', 'b'])
  })

  it('writes nothing when the row stays where it is', () => {
    expect(planMove(rows(1, 1.5, 2), 'b', 1)).toEqual([])
  })

  it('inserts a row coming from another group', () => {
    const group = rows(1, 2)
    const updates = planMove(group, 'x', 1)
    expect(updates).toEqual([{ id: 'x', position: 1.5 }])
    expect(orderAfter(group, updates, { id: 'x', position: 99 })).toEqual(['a', 'x', 'b'])
  })

  it('moves into an empty group at STEP', () => {
    expect(planMove([], 'x', 0)).toEqual([{ id: 'x', position: POSITION_STEP }])
  })

  it('clamps the index', () => {
    expect(planMove(rows(1, 2), 'x', 10)).toEqual([{ id: 'x', position: 3 }])
    expect(planMove(rows(1, 2), 'x', -3)).toEqual([{ id: 'x', position: 0 }])
  })

  it('renumbers the group when the gap is too small', () => {
    const group = rows(1, 1 + MIN_GAP / 4, 2)
    const updates = planMove(group, 'c', 1)
    expect(orderAfter(group, updates)).toEqual(['a', 'c', 'b'])
    expect(sortByPosition(applyPositions(group, updates)).map(r => r.position)).toEqual([1, 2, 3])
  })

  it('separates rows that got the same position from concurrent inserts', () => {
    const group = rows(1, 2, 2)
    const updates = planMove(group, 'x', 2)
    expect(orderAfter(group, updates, { id: 'x', position: 0 })).toEqual(['a', 'b', 'x', 'c'])
    const positions = applyPositions([...group, { id: 'x', position: 0 }], updates).map(r => r.position)
    expect(new Set(positions).size).toBe(4)
  })

  it('survives many moves into the same gap', () => {
    let group = rows(1, 2)
    for (let i = 0; i < 100; i++) {
      const id = `n${i}`
      group = sortByPosition(applyPositions([...group, { id, position: Number.NaN }], planMove(group, id, 1)))
    }
    const sorted = sortByPosition(group)
    expect(sorted[0]!.id).toBe('a')
    expect(sorted.at(-1)!.id).toBe('b')
    expect(sorted[1]!.id).toBe('n99')
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.position - sorted[i - 1]!.position).toBeGreaterThan(0)
    }
  })
})

describe('applyPositions', () => {
  it('replaces changed rows and keeps the others as the same objects', () => {
    const list = [{ id: 'a', position: 1, name: 'Milk' }, { id: 'b', position: 2, name: 'Eggs' }]
    const result = applyPositions(list, [{ id: 'b', position: 0.5 }])
    expect(result[0]).toBe(list[0])
    expect(result[1]).toEqual({ id: 'b', position: 0.5, name: 'Eggs' })
    expect(list[1]!.position).toBe(2)
  })
})
