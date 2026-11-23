<script setup lang="ts">
import * as v from 'valibot'
import { REDIRECT_QUERY, ROUTES } from '#shared/routes'
import { fieldErrors, loginSchema, safeRedirect } from '#shared/validation/auth'

useHead({ title: 'Log in' })

const route = useRoute()
const { signIn } = useAuth()

const form = reactive({ email: '', password: '' })
const errors = ref<Record<string, string>>({})
const formError = ref('')
const pending = ref(false)

const signupLink = computed(() => ({
  path: ROUTES.signup,
  query: route.query[REDIRECT_QUERY] ? { [REDIRECT_QUERY]: route.query[REDIRECT_QUERY] } : {},
}))

async function submit() {
  formError.value = ''
  const parsed = v.safeParse(loginSchema, form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.issues)
    return
  }
  errors.value = {}
  pending.value = true
  const result = await signIn(parsed.output)
  pending.value = false
  if (!result.ok) {
    formError.value = result.message
    return
  }
  // The middleware routes on from here (onboarding if no household yet).
  await navigateTo(safeRedirect(route.query[REDIRECT_QUERY]))
}
</script>

<template>
  <AuthCard title="Log in">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <FormField
        id="email"
        v-model="form.email"
        label="Email"
        type="email"
        autocomplete="email"
        inputmode="email"
        autofocus
        :error="errors.email"
      />
      <FormField
        id="password"
        v-model="form.password"
        label="Password"
        type="password"
        autocomplete="current-password"
        :error="errors.password"
      />
      <p v-if="formError" role="alert" class="text-sm text-destructive">
        {{ formError }}
      </p>
      <Button type="submit" class="w-full" :disabled="pending">
        {{ pending ? 'Logging in…' : 'Log in' }}
      </Button>
    </form>
    <template #footer>
      No account yet?
      <NuxtLink :to="signupLink" class="font-medium text-foreground underline underline-offset-4">
        Sign up
      </NuxtLink>
    </template>
  </AuthCard>
</template>
