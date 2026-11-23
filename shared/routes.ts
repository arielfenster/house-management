/**
 * App route paths. Pages are file-based (`app/pages/*`), so each value must match its page file:
 * renaming a page means updating it here.
 */
export const ROUTES = {
  home: '/',
  login: '/login',
  signup: '/signup',
  onboarding: '/onboarding',
  /** Invite link prefix: `/join/<invite code>` (see `joinPath`). */
  join: '/join/',
} as const

/** Query parameter carrying the page to return to after login/signup (`/login?redirect=/join/abc`). */
export const REDIRECT_QUERY = 'redirect'

/** Query parameter pre-filling the invite code on onboarding (`/onboarding?code=…`, set by `/join/<code>`). */
export const INVITE_CODE_QUERY = 'code'

/** Invite link path for a household invite code. */
export function joinPath(inviteCode: string): string {
  return `${ROUTES.join}${encodeURIComponent(inviteCode)}`
}

/** Path without query string or hash (`/join/abc?x=1` → `/join/abc`). */
function pathname(path: string): string {
  return path.split(/[?#]/, 1)[0] ?? path
}

/** Login and signup: only for signed-out users. */
export function isAuthPage(path: string): boolean {
  const p = pathname(path)
  return p === ROUTES.login || p === ROUTES.signup
}

/** Pages a signed-in user without a household may visit (invite links work before onboarding). */
export function isOnboardingPage(path: string): boolean {
  const p = pathname(path)
  return p === ROUTES.onboarding || p.startsWith(ROUTES.join)
}
