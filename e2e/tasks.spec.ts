import { expect, test } from '@playwright/test'
import { signUpWithHousehold } from './support/session'
import { deleteUser, newUser } from './support/users'

// TASKS-006: task list basics — empty state, quick add, one-tap completion (through POST /api/tasks/:id/complete)
// and undo. The fuller task e2e suite is TASKS-011.

test('quick add, complete and undo a task', async ({ page }, testInfo) => {
  const user = newUser(`tasks-${testInfo.project.name}`)

  try {
    await signUpWithHousehold(page, user)

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

// TASKS-007: full form — create a repeating task with a due date, edit it, delete it.
test('create, edit and delete a task with the form', async ({ page }, testInfo) => {
  const user = newUser(`taskform-${testInfo.project.name}`)

  try {
    await signUpWithHousehold(page, user)

    // "Add with details" carries over what was typed.
    await page.getByLabel('New task').fill('Clean AC filters')
    await page.getByRole('button', { name: 'Add with details' }).click()
    const sheet = page.getByRole('dialog', { name: 'New task' })
    await expect(sheet.getByLabel('Title')).toHaveValue('Clean AC filters')

    // Validation: a repeating task needs a whole-number interval.
    await sheet.getByRole('button', { name: 'Repeats' }).click()
    await sheet.getByLabel('Interval').fill('0')
    await sheet.getByRole('button', { name: 'Add task' }).click()
    await expect(sheet.getByText(/whole number/)).toBeVisible()

    await sheet.getByLabel('Interval').fill('3')
    await sheet.getByLabel('Unit').selectOption('month')
    await sheet.getByRole('button', { name: 'Tomorrow' }).click()
    await expect(sheet.getByLabel('First due')).toBeVisible()
    await expect(sheet.getByText('Due tomorrow, then every 3 months after each completion.')).toBeVisible()
    await sheet.getByLabel('Assigned to').selectOption({ label: user.displayName })
    await sheet.getByRole('button', { name: 'Add task' }).click()
    await expect(sheet).toBeHidden()

    const row = page.getByRole('list', { name: 'Tasks' }).getByRole('listitem').filter({ hasText: 'Clean AC filters' })
    await expect(row).toContainText('Every 3 months')
    await expect(row).toContainText(user.displayName)
    await expect(row).toContainText('Tomorrow')

    // Edit: becomes a one-time task without a date.
    await row.getByRole('button', { name: /Clean AC filters/ }).click()
    const edit = page.getByRole('dialog', { name: 'Edit task' })
    await expect(edit.getByLabel('Title')).toHaveValue('Clean AC filters')
    await expect(edit.getByLabel('Next due')).toBeVisible()
    await edit.getByRole('button', { name: 'One-time' }).click()
    await edit.getByRole('button', { name: 'No date' }).click()
    await edit.getByLabel('Title').fill('Replace AC filters')
    await edit.getByRole('button', { name: 'Save' }).click()
    await expect(edit).toBeHidden()
    const edited = page.getByRole('list', { name: 'Tasks' }).getByRole('listitem').filter({ hasText: 'Replace AC filters' })
    await expect(edited).not.toContainText('Every 3 months')
    await page.reload()
    await expect(edited).toBeVisible()

    // Delete (undo is tested above for completion; here the toast appears and the row goes).
    await edited.getByRole('button', { name: /Replace AC filters/ }).click()
    await page.getByRole('dialog', { name: 'Edit task' }).getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Deleted “Replace AC filters”')).toBeVisible()
    await expect(edited).toHaveCount(0)
  } finally {
    await deleteUser(user.email)
  }
})
