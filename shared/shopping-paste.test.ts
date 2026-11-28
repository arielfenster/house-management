import { describe, expect, it } from 'vitest'
import { SHOPPING_ITEM_NAME_MAX, cleanItemName, isMultiItemPaste, parseItemLines } from './shopping-paste'

describe('parseItemLines', () => {
  it('gives one item per non-empty line, in order', () => {
    expect(parseItemLines('milk\ncheese\n\n  \neggs\n')).toEqual(['milk', 'cheese', 'eggs'])
  })

  it('handles Windows, old Mac and Unicode line breaks', () => {
    expect(parseItemLines('a\r\nb\rc\u2028d')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('returns nothing for empty or whitespace-only text', () => {
    expect(parseItemLines('')).toEqual([])
    expect(parseItemLines(' \n\t\n ')).toEqual([])
  })

  it('keeps duplicates', () => {
    expect(parseItemLines('milk\nmilk')).toEqual(['milk', 'milk'])
  })

  it('keeps Hebrew and mixed text as typed', () => {
    expect(parseItemLines('חלב\nקוטג\' 5%\nAvocado ×3')).toEqual(['חלב', 'קוטג\' 5%', 'Avocado ×3'])
  })

  it('drops list markers from notes and chat apps', () => {
    const pasted = ['- Milk', '* Bread', '• Eggs', '1. Tomatoes', '2) Cucumbers', '[ ] Butter', '- [x] Salt', '☐ Rice', '✔ Pasta'].join('\n')
    expect(parseItemLines(pasted)).toEqual(['Milk', 'Bread', 'Eggs', 'Tomatoes', 'Cucumbers', 'Butter', 'Salt', 'Rice', 'Pasta'])
  })

  it('drops lines that are only a marker', () => {
    expect(parseItemLines('-\n•\n1.\nmilk')).toEqual(['milk'])
  })
})

describe('cleanItemName', () => {
  it('trims and collapses inner whitespace', () => {
    expect(cleanItemName('  olive \t  oil  ')).toBe('olive oil')
  })

  it('does not treat quantities as numbering', () => {
    expect(cleanItemName('3 eggs')).toBe('3 eggs')
    expect(cleanItemName('1.5 kg flour')).toBe('1.5 kg flour')
    expect(cleanItemName('2% milk')).toBe('2% milk')
    expect(cleanItemName('-20% off coupon')).toBe('-20% off coupon')
  })

  it('cuts names to the database limit without splitting characters', () => {
    expect(cleanItemName('a'.repeat(250))).toHaveLength(SHOPPING_ITEM_NAME_MAX)
    const emoji = cleanItemName('🍎'.repeat(250))
    expect(Array.from(emoji)).toHaveLength(SHOPPING_ITEM_NAME_MAX)
    expect(emoji.endsWith('🍎')).toBe(true)
  })
})

describe('isMultiItemPaste', () => {
  it('is true only when the text has more than one item', () => {
    expect(isMultiItemPaste('milk')).toBe(false)
    expect(isMultiItemPaste('milk\n')).toBe(false)
    expect(isMultiItemPaste('milk\n\n')).toBe(false)
    expect(isMultiItemPaste('milk\neggs')).toBe(true)
  })
})
