import { expect, type Page } from '@playwright/test'
import { APP_HOME, ROUTES, joinPath } from '../../shared/routes'
import type { E2eUser } from './users'

/**
 * Waits until Vue has mounted (hydrated) the page. Filling inputs before that loses the text: hydration resets the
 * server-rendered fields to the component state (seen as a flaky "Enter your email." under parallel load).
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))
}

/** Signs `user` up through the UI and creates a household, ending on the task list. */
export async function signUpWithHousehold(page: Page, user: E2eUser, householdName = 'E2E home'): Promise<void> {
  await page.goto(ROUTES.signup)
  await waitForHydration(page)
  await page.getByLabel('Your name').fill(user.displayName)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page).toHaveURL(new RegExp(`${ROUTES.onboarding}$`), { timeout: 15_000 })
  await page.getByLabel('Household name').fill(householdName)
  await page.getByRole('button', { name: 'Create household' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(new RegExp(`${APP_HOME}$`), { timeout: 15_000 })
}

/** Signs `user` up through the UI and joins an existing household with its invite code, ending on the task list. */
export async function signUpAndJoin(page: Page, user: E2eUser, inviteCode: string): Promise<void> {
  await page.goto(ROUTES.signup)
  await waitForHydration(page)
  await page.getByLabel('Your name').fill(user.displayName)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page).toHaveURL(new RegExp(`${ROUTES.onboarding}$`), { timeout: 15_000 })
  // The invite link pre-fills the code on onboarding.
  await page.goto(joinPath(inviteCode))
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Join household' }).click()
  await expect(page).toHaveURL(new RegExp(`${APP_HOME}$`), { timeout: 15_000 })
}
