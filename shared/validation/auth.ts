import * as v from 'valibot'
import { ROUTES } from '../routes'

// Keep in sync with supabase/config.toml `minimum_password_length` (and the prod Auth setting).
export const PASSWORD_MIN_LENGTH = 6
export const DISPLAY_NAME_MAX_LENGTH = 50

const email = v.pipe(
  v.string(),
  v.trim(),
  v.toLowerCase(),
  v.nonEmpty('Enter your email.'),
  v.email('Enter a valid email address.'),
)

export const loginSchema = v.object({
  email,
  password: v.pipe(v.string(), v.nonEmpty('Enter your password.')),
})

export const signupSchema = v.object({
  displayName: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Enter your name.'),
    v.maxLength(DISPLAY_NAME_MAX_LENGTH, `Use at most ${DISPLAY_NAME_MAX_LENGTH} characters.`),
  ),
  email,
  password: v.pipe(
    v.string(),
    v.minLength(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`),
  ),
})

export type LoginInput = v.InferOutput<typeof loginSchema>
export type SignupInput = v.InferOutput<typeof signupSchema>

/** First issue message per top-level field, for inline form errors. */
export function fieldErrors(issues: v.BaseIssue<unknown>[]): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path?.[0]?.key
    if (typeof key === 'string' && !(key in errors)) {
      errors[key] = issue.message
    }
  }
  return errors
}

/**
 * Returns `value` if it is a same-origin app path (e.g. `/join/abc?x=1`), else `fallback`.
 * Guards the `?redirect=` query against open redirects (`//evil.com`, `/\evil.com`, `https://…`).
 */
export function safeRedirect(value: unknown, fallback: string = ROUTES.home): string {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return fallback
  }
  if (value.startsWith('//') || value.startsWith('/\\')) {
    return fallback
  }
  // Control characters / whitespace can be normalised by browsers into a protocol-relative URL.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\s]/.test(value)) {
    return fallback
  }
  return value
}

/** Maps Supabase Auth error codes to user-facing text. */
export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'invalid_credentials':
      return 'Wrong email or password.'
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists. Log in instead.'
    case 'weak_password':
      return `Password is too weak. Use at least ${PASSWORD_MIN_LENGTH} characters.`
    case 'signup_disabled':
      return 'Sign-up is closed. Ask a household member for help.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts. Wait a minute and try again.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
