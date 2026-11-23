import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { fieldErrors } from './auth'
import { createHouseholdSchema, householdErrorMessage, joinHouseholdSchema, parseInviteCode } from './household'

const CODE = '0f1e2d3c4b5a69788796a5b4c3d2e1f0'

describe('parseInviteCode', () => {
  it.each([
    [CODE, CODE],
    [`  ${CODE.toUpperCase()} `, CODE],
    [`https://home.example.com/join/${CODE}`, CODE],
    [`http://localhost:3000/join/${CODE}?utm=x#top`, CODE],
    [`/join/${CODE}/`, CODE],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(parseInviteCode(input)).toBe(expected)
  })
})

describe('joinHouseholdSchema', () => {
  it('accepts a pasted link and outputs the code', () => {
    expect(v.parse(joinHouseholdSchema, { inviteCode: `https://x.test/join/${CODE}` })).toEqual({
      inviteCode: CODE,
    })
  })

  it.each([
    ['', 'Enter the invite code.'],
    ['abc', 'That doesn’t look like an invite code.'],
    ['not a code at all!', 'That doesn’t look like an invite code.'],
  ])('rejects %j', (inviteCode, message) => {
    const res = v.safeParse(joinHouseholdSchema, { inviteCode })
    expect(res.success).toBe(false)
    expect(fieldErrors(res.issues ?? [])).toEqual({
      inviteCode: message,
    })
  })
})

describe('createHouseholdSchema', () => {
  it('trims and keeps Hebrew names', () => {
    expect(v.parse(createHouseholdSchema, { name: ' הבית שלנו ', timezone: 'Asia/Jerusalem' })).toEqual({
      name: 'הבית שלנו',
      timezone: 'Asia/Jerusalem',
    })
  })

  it('rejects blank and too long names', () => {
    expect(v.safeParse(createHouseholdSchema, { name: '  ', timezone: 'UTC' }).success).toBe(false)
    expect(v.safeParse(createHouseholdSchema, { name: 'x'.repeat(101), timezone: 'UTC' }).success).toBe(false)
  })
})

describe('householdErrorMessage', () => {
  it('maps RPC errors and falls back for unknown ones', () => {
    expect(householdErrorMessage('invalid_invite_code')).toMatch(/not valid/)
    expect(householdErrorMessage('boom')).toBe('Something went wrong. Please try again.')
  })
})
