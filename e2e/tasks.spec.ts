import { expect, test } from '@playwright/test'
import { APP_HOME, ROUTES } from '../shared/routes'
import { deleteUser, newUser } from './support/users'

// TASKS-006: task list basics — empty state, quick add, one-tap completion (through POST /api/tasks/:id/complete)
// and undo. The fuller task e2e suite is TASKS-011.

test('quick add, complete and undo a task', async ({ page }, testInfo) => {
  const user = newUser(`tasks-${testInfo.project.name}`)

  try {
    await page.goto(ROUTES.signup)
    await page.getByLabel('Your name').fill(user.displayName)
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password').fill(user.password)
    await page.getByRole('button', { name: 'Sign up' }).click()
    await page.getByLabel('Household name').fill('E2E home')
    await page.getByRole('button', { name: 'Create household' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(new RegExp(`${APP_HOME}$`))

    await expect(page.getByText('No tasks yet')).toBeVisible()

    // Quick add: Enter creates the task; the field is cleared for the next one.
    const quickAdd = page.getByLabel('New task')
    await quickAdd.fill('Water plants')
    await quickAdd.press('Enter')
    await expect(quickAdd).toHaveValue('')
    const list = page.getByRole('list', { name: 'Tasks' })
    const row = list.getByRole('listitem').filter({ hasText: 'Water plants' })
    await expect(row).toBeVisible()

    // Saved: still there after a reload.
    await page.reload()
    await expect(row).toBeVisible()

    // Complete: it leaves the list, with an undo toast.
    await page.getByRole('checkbox', { name: 'Complete Water plants' }).click()
    await expect(page.getByText('Completed “Water plants”')).toBeVisible()
    await expect(row).toHaveCount(0)

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(row).toBeVisible()
    await page.reload()
    await expect(row).toBeVisible()
  } finally {
    await deleteUser(user.email)
  }
})
