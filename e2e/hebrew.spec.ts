import { expect, test, type Locator } from '@playwright/test'
import { APP_HOME, ROUTES } from '../shared/routes'
import { deleteUser, newUser } from './support/users'

// FOUNDATION-016 (D17): the UI is English/LTR, but user content may be Hebrew or mixed.
// `dir="auto"` must right-align Hebrew-first text and keep English-first text left-aligned,
// and the text must round-trip unchanged through the database.

const HEBREW_NAME = 'אריאל'
const HEBREW_FIRST = 'בית Cohen 2'
const ENGLISH_FIRST = 'Cohen בית'

/** The direction the browser resolved for the element (`dir="auto"` → first strong character). */
async function direction(locator: Locator): Promise<'rtl' | 'ltr'> {
  return locator.evaluate(el => (el.matches(':dir(rtl)') ? 'rtl' : 'ltr'))
}

test('Hebrew and mixed user content: entry, direction and display', async ({ page }, testInfo) => {
  const user = newUser(`he-${testInfo.project.name}`)

  try {
    await page.goto(ROUTES.signup)
    const nameField = page.getByLabel('Your name')
    await nameField.fill(HEBREW_NAME)
    await expect(nameField).toHaveAttribute('dir', 'auto')
    expect(await direction(nameField)).toBe('rtl')
    // Latin-only fields stay left-to-right.
    await page.getByLabel('Email').fill(user.email)
    expect(await direction(page.getByLabel('Email'))).toBe('ltr')
    await page.getByLabel('Password').fill(user.password)
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page).toHaveURL(new RegExp(`${ROUTES.onboarding}$`))

    // Mixed text: the first strong character decides the direction.
    const householdField = page.getByLabel('Household name')
    await householdField.fill(ENGLISH_FIRST)
    expect(await direction(householdField)).toBe('ltr')
    await householdField.fill(HEBREW_FIRST)
    expect(await direction(householdField)).toBe('rtl')
    await page.getByRole('button', { name: 'Create household' }).click()

    // Saved and shown back unchanged, right-to-left, inside the English sentence.
    const inline = page.getByText(HEBREW_FIRST, { exact: true })
    await expect(inline).toBeVisible()
    expect(await direction(inline)).toBe('rtl')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(new RegExp(`${APP_HOME}$`))

    // Account sheet title (phone: header button; desktop: sidebar button, which also shows the name).
    await page.getByRole('button', { name: 'Household and account' }).click()
    const title = page.getByRole('dialog').getByRole('heading', { name: HEBREW_FIRST }).getByText(HEBREW_FIRST)
    await expect(title).toBeVisible()
    expect(await direction(title)).toBe('rtl')
  } finally {
    await deleteUser(user.email)
  }
})
