import { describe, expect, it } from 'vitest'
import { checkSectionName } from './shopping'

const sections = [
  { id: '1', name: 'Produce' },
  { id: '2', name: 'מוצרי חלב' },
]

describe('checkSectionName', () => {
  it('trims and accepts a new name', () => {
    expect(checkSectionName('  Bakery ', sections)).toEqual({ ok: true, name: 'Bakery' })
  })

  it('rejects blank and too long names', () => {
    expect(checkSectionName('   ', sections)).toEqual({ ok: false, error: 'Enter a name.' })
    expect(checkSectionName('x'.repeat(51), sections)).toEqual({ ok: false, error: 'Use at most 50 characters.' })
    expect(checkSectionName('x'.repeat(50), sections).ok).toBe(true)
  })

  it('rejects an existing name, ignoring case', () => {
    expect(checkSectionName('produce', sections)).toEqual({ ok: false, error: 'There is already a “produce” section.' })
    expect(checkSectionName('מוצרי חלב', sections).ok).toBe(false)
  })

  it('allows keeping or re-casing the name of the section being renamed', () => {
    expect(checkSectionName('PRODUCE', sections, '1')).toEqual({ ok: true, name: 'PRODUCE' })
    expect(checkSectionName('Produce', sections, '2').ok).toBe(false)
  })
})
