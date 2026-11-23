import { safeRedirect } from '#shared/validation/auth'

const AUTH_PAGES = new Set(['/login', '/signup'])

/** Pages a signed-in user without a household may visit (invite links work before onboarding). */
function isOnboardingPage(path: string) {
  return path === '/onboarding' || path.startsWith('/join/')
}

/**
 * Routing gate: signed out → /login; signed in without a household → /onboarding; else the app.
 * This is UX only. Data access is authorized by RLS (docs/04-AUTHORIZATION.md).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // JWT claims (verified via getClaims by @nuxtjs/supabase on server and client).
  const userId = useSupabaseUser().value?.sub

  if (!userId) {
    if (AUTH_PAGES.has(to.path)) return
    return navigateTo({ path: '/login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } })
  }

  const householdId = await useMembership().load(userId)

  if (!householdId) {
    if (isOnboardingPage(to.path)) return
    // Coming from /login?redirect=/join/<code>: honour the invite link.
    const target = AUTH_PAGES.has(to.path) ? safeRedirect(to.query.redirect, '/onboarding') : '/onboarding'
    return navigateTo(isOnboardingPage(target) ? target : '/onboarding')
  }

  if (AUTH_PAGES.has(to.path) || isOnboardingPage(to.path)) {
    const target = AUTH_PAGES.has(to.path) ? safeRedirect(to.query.redirect) : '/'
    return navigateTo(AUTH_PAGES.has(target) || isOnboardingPage(target) ? '/' : target)
  }
})
