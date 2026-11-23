import { describe, expect, it } from 'vitest'
import { ROUTES, isAuthPage, isOnboardingPage, joinPath } from './routes'

describe('route groups', () => {
  it('detects auth pages, ignoring query and hash', () => {
    expect(isAuthPage(ROUTES.login)).toBe(true)
    expect(isAuthPage(`${ROUTES.signup}?redirect=/x`)).toBe(true)
    expect(isAuthPage(ROUTES.onboarding)).toBe(false)
    expect(isAuthPage('/login-help')).toBe(false)
  })

  it('treats onboarding and invite links as onboarding pages', () => {
    expect(isOnboardingPage(ROUTES.onboarding)).toBe(true)
    expect(isOnboardingPage(joinPath('abc123'))).toBe(true)
    expect(isOnboardingPage(`${joinPath('abc123')}#x`)).toBe(true)
    expect(isOnboardingPage(ROUTES.home)).toBe(false)
  })
})

describe('joinPath', () => {
  it('builds an encoded invite link path', () => {
    expect(joinPath('abc123')).toBe('/join/abc123')
    expect(joinPath('a/b')).toBe('/join/a%2Fb')
  })
})
