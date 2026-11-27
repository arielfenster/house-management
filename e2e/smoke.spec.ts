import { expect, test } from '@playwright/test'
import { APP_HOME, ROUTES } from '../shared/routes'
import { deleteUser, newUser } from './support/users'

// FOUNDATION-012 smoke: signup → create household → the four routes → log out → log in.
// Runs once per project (phone bottom bar, desktop sidebar), each with its own user.

const NAV_PAGES = [
  {
    label: 'Files',
    path: ROUTES.files,
  },
  {
    label: 'Shopping',
    path: ROUTES.shopping,
  },
  {
    label: 'Notifications',
    path: ROUTES.notifications,
  },
  {
    label: 'Tasks',
    path: ROUTES.tasks,
  },
]

function urlPath(path: string): RegExp {
  return new RegExp(`${path.replace(/[/]/g, '\\/')}(\\?.*)?$`)
}

test('sign up, create a household, navigate, log out and back in', async ({ page }, testInfo) => {
  const user = newUser(testInfo.project.name)

  try {
    // Sign up: a new user has no household, so they land on onboarding.
    await page.goto(ROUTES.signup)
    await page.getByLabel('Your name').fill(user.displayName)
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password').fill(user.password)
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page).toHaveURL(urlPath(ROUTES.onboarding))

    // Create a household, see the invite step, continue into the app.
    await page.getByLabel('Household name').fill('E2E home')
    await page.getByRole('button', { name: 'Create household' }).click()
    await expect(page.getByText('Household created')).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(urlPath(APP_HOME))
    await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible()

    // The visible nav (bottom bar on phones, sidebar on desktop): exactly four destinations.
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav).toHaveCount(1)
    await expect(nav.getByRole('link')).toHaveCount(4)

    for (const { label, path } of NAV_PAGES) {
      const link = nav.getByRole('link', { name: label })
      await link.click()
      await expect(page).toHaveURL(urlPath(path))
      await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible()
      await expect(link).toHaveAttribute('aria-current', 'page')
    }

    // `/` redirects members to the app home.
    await page.goto(ROUTES.home)
    await expect(page).toHaveURL(urlPath(APP_HOME))

    // Log out from the household/account sheet.
    await page.getByRole('button', { name: 'Household and account' }).click()
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL(urlPath(ROUTES.login))

    // Log back in: straight into the app (the household already exists).
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password').fill(user.password)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(urlPath(APP_HOME))
    await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible()
  } finally {
    await deleteUser(user.email)
  }
})
