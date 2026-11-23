import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { authErrorMessage, fieldErrors, loginSchema, safeRedirect, signupSchema } from './auth'

describe('safeRedirect', () => {
  it.each(['/', '/tasks', '/join/abc123', '/tasks?id=1#x'])('keeps app path %s', (path) => {
    expect(safeRedirect(path)).toBe(path)
  })

  it.each([
    undefined,
    null,
    ['/tasks'],
    '',
    'tasks',
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    '/\t/evil.com',
    '/ /evil.com',
    'javascript:alert(1)',
  ])('rejects %j', (value) => {
    expect(safeRedirect(value, '/fallback')).toBe('/fallback')
  })
})

describe('signupSchema', () => {
  it('trims name, normalises email and keeps Hebrew names', () => {
    const out = v.parse(signupSchema, { displayName: '  דנה ', email: ' Dana@Example.COM ', password: 'secret1' })
    expect(out).toEqual({ displayName: 'דנה', email: 'dana@example.com', password: 'secret1' })
  })

  it('reports one message per invalid field', () => {
    const res = v.safeParse(signupSchema, { displayName: '   ', email: 'nope', password: '123' })
    expect(res.success).toBe(false)
    expect(fieldErrors(res.issues ?? [])).toEqual({
      displayName: 'Enter your name.',
      email: 'Enter a valid email address.',
      password: 'Use at least 6 characters.',
    })
  })
})

describe('loginSchema', () => {
  it('requires a password but not a minimum length', () => {
    expect(v.safeParse(loginSchema, { email: 'a@b.co', password: 'x' }).success).toBe(true)
    expect(v.safeParse(loginSchema, { email: 'a@b.co', password: '' }).success).toBe(false)
  })
})

describe('authErrorMessage', () => {
  it('maps known codes and falls back for unknown ones', () => {
    expect(authErrorMessage('invalid_credentials')).toBe('Wrong email or password.')
    expect(authErrorMessage(undefined)).toBe('Something went wrong. Please try again.')
  })
})
