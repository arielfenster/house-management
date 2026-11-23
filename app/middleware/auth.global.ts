import { APP_HOME, REDIRECT_QUERY, ROUTES, isAuthPage, isOnboardingPage } from '#shared/routes'
import { safeRedirect } from '#shared/validation/auth'

/**
 * Routing gate: signed out → login; signed in without a household → onboarding; else the app
 * (`/` → APP_HOME).
 * This is UX only. Data access is authorized by RLS (docs/04-AUTHORIZATION.md).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // JWT claims (verified via getClaims by @nuxtjs/supabase on server and client).
  const userId = useSupabaseUser().value?.sub

  if (!userId) {
    if (isAuthPage(to.path)) {
      return
    }
    return navigateTo({
      path: ROUTES.login,
      query: to.fullPath === ROUTES.home ? {} : { [REDIRECT_QUERY]: to.fullPath },
    })
  }

  const householdId = await useMembership().load(userId)

  if (!householdId) {
    if (isOnboardingPage(to.path)) {
      return
    }
    // Coming from login with an invite link as the redirect target: honour it.
    const target = isAuthPage(to.path) ? safeRedirect(to.query[REDIRECT_QUERY], ROUTES.onboarding) : ROUTES.onboarding
    return navigateTo(isOnboardingPage(target) ? target : ROUTES.onboarding)
  }

  if (isAuthPage(to.path) || isOnboardingPage(to.path)) {
    const target = isAuthPage(to.path) ? safeRedirect(to.query[REDIRECT_QUERY], APP_HOME) : APP_HOME
    return navigateTo(isAuthPage(target) || isOnboardingPage(target) || target === ROUTES.home ? APP_HOME : target)
  }

  if (to.path === ROUTES.home) {
    return navigateTo(APP_HOME, { replace: true })
  }
})
