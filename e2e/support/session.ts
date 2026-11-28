import { expect, type Page } from '@playwright/test'
import { APP_HOME, ROUTES } from '../../shared/routes'
import type { E2eUser } from './users'

/** Signs `user` up through the UI and creates a household, ending on the task list. */
export async function signUpWithHousehold(page: Page, user: E2eUser, householdName = 'E2E home'): Promise<void> {
  await page.goto(ROUTES.signup)
  await page.getByLabel('Your name').fill(user.displayName)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page).toHaveURL(new RegExp(`${ROUTES.onboarding}$`))
  await page.getByLabel('Household name').fill(householdName)
  await page.getByRole('button', { name: 'Create household' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(new RegExp(`${APP_HOME}$`))
}
