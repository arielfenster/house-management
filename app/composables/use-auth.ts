import type { Session } from '@supabase/supabase-js'
import type { LoginInput, SignupInput } from '#shared/validation/auth'
import { authErrorMessage } from '#shared/validation/auth'

type AuthResult = { ok: true } | { ok: false, message: string }

/** Email + password auth (D11: no confirmation emails, signup returns a session immediately). */
export function useAuth() {
  const supabase = useSupabaseClient()
  const session = useSupabaseSession()
  const user = useSupabaseUser()
  const membership = useMembership()

  // The module refreshes these from onAuthStateChange asynchronously; set them now so the
  // route middleware sees the new user on the very next navigation.
  async function syncAuthState(newSession: Session) {
    session.value = newSession
    const { data } = await supabase.auth.getClaims()
    user.value = data?.claims ?? null
    membership.reset()
  }

  async function signIn(input: LoginInput): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword(input)
    if (error) return { ok: false, message: authErrorMessage(error.code) }
    await syncAuthState(data.session)
    return { ok: true }
  }

  async function signUp(input: SignupInput): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { display_name: input.displayName } }, // read by the profiles signup trigger
    })
    if (error) return { ok: false, message: authErrorMessage(error.code) }
    if (!data.session) {
      // Only happens if "Confirm email" was turned on in the Auth settings (it must stay off, D11).
      return { ok: false, message: 'Account created, but email confirmation is required. Ask the admin to disable it.' }
    }
    await syncAuthState(data.session)
    return { ok: true }
  }

  async function signOut() {
    await supabase.auth.signOut()
    session.value = null
    user.value = null
    membership.reset()
    await navigateTo('/login')
  }

  return { signIn, signUp, signOut }
}
