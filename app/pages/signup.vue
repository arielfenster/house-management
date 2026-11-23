<script setup lang="ts">
import * as v from 'valibot'
import { DISPLAY_NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH, fieldErrors, safeRedirect, signupSchema } from '#shared/validation/auth'

useHead({ title: 'Sign up' })

const route = useRoute()
const { signUp } = useAuth()

const form = reactive({ displayName: '', email: '', password: '' })
const errors = ref<Record<string, string>>({})
const formError = ref('')
const pending = ref(false)

const loginLink = computed(() => ({ path: '/login', query: route.query.redirect ? { redirect: route.query.redirect } : {} }))

async function submit() {
  formError.value = ''
  const parsed = v.safeParse(signupSchema, form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.issues)
    return
  }
  errors.value = {}
  pending.value = true
  const result = await signUp(parsed.output)
  pending.value = false
  if (!result.ok) {
    formError.value = result.message
    return
  }
  // A new user has no household, so the middleware sends them to onboarding (or the invite link).
  await navigateTo(safeRedirect(route.query.redirect, '/onboarding'))
}
</script>

<template>
  <AuthCard title="Create account">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <AuthFormField
        id="display-name"
        v-model="form.displayName"
        label="Your name"
        autocomplete="name"
        dir="auto"
        :maxlength="DISPLAY_NAME_MAX_LENGTH"
        autofocus
        :error="errors.displayName"
      />
      <AuthFormField
        id="email"
        v-model="form.email"
        label="Email"
        type="email"
        autocomplete="email"
        inputmode="email"
        :error="errors.email"
      />
      <AuthFormField
        id="password"
        v-model="form.password"
        label="Password"
        type="password"
        autocomplete="new-password"
        :placeholder="`At least ${PASSWORD_MIN_LENGTH} characters`"
        :error="errors.password"
      />
      <p v-if="formError" role="alert" class="text-sm text-destructive">
        {{ formError }}
      </p>
      <Button type="submit" class="w-full" :disabled="pending">
        {{ pending ? 'Creating account…' : 'Sign up' }}
      </Button>
    </form>
    <template #footer>
      Already have an account?
      <NuxtLink :to="loginLink" class="font-medium text-foreground underline underline-offset-4">
        Log in
      </NuxtLink>
    </template>
  </AuthCard>
</template>
