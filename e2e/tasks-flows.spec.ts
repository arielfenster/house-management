import { expect, test, type Page } from '@playwright/test'
import { signUpWithHousehold } from './support/session'
import { deleteUser, newUser } from './support/users'

// TASKS-011: the main task workflows end to end, on the phone and desktop projects:
// repeating task completion (next due date + history), inline categories/rooms with filters and search,
// the Done tab, and a phone layout check.

function taskList(page: Page) {
  return page.getByRole('list', { name: 'Tasks' })
}

function row(page: Page, title: string) {
  return taskList(page).getByRole('listitem').filter({ hasText: title })
}

async function openNewTaskForm(page: Page, title: string) {
  await page.getByLabel('Quick add a task').fill(title)
  await page.getByRole('button', { name: 'New task' }).click()
  return page.getByRole('dialog', { name: 'New task' })
}

test('repeating task: completing it schedules the next one and records history', async ({ page }, testInfo) => {
  const user = newUser(`recur-${testInfo.project.name}`)
  try {
    await signUpWithHousehold(page, user)

    const sheet = await openNewTaskForm(page, 'Water plants')
    await sheet.getByRole('button', { name: 'Repeats' }).click()
    // "Repeats" starts the first due date at today; weekly by default.
    await expect(sheet.getByText('Due today, then every week after each completion.')).toBeVisible()
    await sheet.getByRole('button', { name: 'Add task' }).click()
    await expect(sheet).toBeHidden()
    await expect(row(page, 'Water plants')).toContainText('Today')
    await expect(row(page, 'Water plants')).toContainText('Weekly')

    // Complete: due again in a week (completion day + interval, D10); undo toast offered.
    await page.getByRole('checkbox', { name: 'Complete Water plants' }).click()
    await expect(page.getByText(/“Water plants” is next due in 7 days/)).toBeVisible()
    await expect(row(page, 'Water plants')).toContainText('in 7 d')
    await page.reload()
    await expect(row(page, 'Water plants')).toContainText('in 7 d')

    // History in the task sheet: done today, by me, on time.
    await row(page, 'Water plants').getByRole('button', { name: /Water plants/ }).click()
    const history = page.getByRole('region', { name: 'Completion history' })
    await expect(history).toContainText(`Last done Today by ${user.displayName}`)
    await expect(history).toContainText('On time')
    await expect(page.getByRole('dialog').getByLabel('Next due')).toBeVisible()
  } finally {
    await deleteUser(user.email)
  }
})

test('custom category and room inline, then filter, search and rename', async ({ page }, testInfo) => {
  const user = newUser(`cat-${testInfo.project.name}`)
  try {
    await signUpWithHousehold(page, user)

    // A new category and room created from the form, auto-selected.
    const sheet = await openNewTaskForm(page, 'Prune the lemon tree')
    await sheet.getByRole('button', { name: /^Category/ }).click()
    await sheet.getByLabel('Search or add category').fill('Garden')
    await sheet.getByRole('button', { name: 'Add “Garden”' }).click()
    await expect(sheet.getByRole('button', { name: /^Category/ })).toContainText('Garden')
    await sheet.getByRole('button', { name: /^Room/ }).click()
    await sheet.getByLabel('Search or add room').fill('Yard')
    await sheet.getByLabel('Search or add room').press('Enter')
    await expect(sheet.getByRole('button', { name: /^Room/ })).toContainText('Yard')
    await sheet.getByRole('button', { name: 'Add task' }).click()
    await expect(sheet).toBeHidden()
    await expect(row(page, 'Prune the lemon tree')).toContainText('Category:Garden')
    await expect(row(page, 'Prune the lemon tree')).toContainText('Room:Yard')

    // A second task in another (default) category.
    await page.getByLabel('Quick add a task').fill('Descale the kettle')
    await page.getByLabel('Quick add a task').press('Enter')
    await expect(row(page, 'Descale the kettle')).toBeVisible()

    // Filters sheet: pick the new category; the sheet shows how many tasks match.
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    const filters = page.getByRole('dialog', { name: 'Filters' })
    await filters.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Garden' }).click()
    await expect(filters.getByRole('button', { name: 'Show 1 task' })).toBeVisible()
    await filters.getByRole('button', { name: 'Show 1 task' }).click()
    await expect(filters).toBeHidden()
    await expect(taskList(page).getByRole('listitem')).toHaveCount(1)
    await expect(row(page, 'Prune the lemon tree')).toBeVisible()
    // Active filter chip; removing it shows everything again.
    await page.getByRole('button', { name: 'Remove filter Category: Garden' }).click()
    await expect(taskList(page).getByRole('listitem')).toHaveCount(2)

    // Assignee: nothing is assigned to me yet; both tasks are unassigned.
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await filters.getByRole('group', { name: 'Assigned to' }).getByRole('button', { name: user.displayName }).click()
    await expect(filters.getByRole('button', { name: 'Show 0 tasks' })).toBeVisible()
    await filters.getByRole('group', { name: 'Assigned to' }).getByRole('button', { name: 'Unassigned' }).click()
    await expect(filters.getByRole('button', { name: 'Show 2 tasks' })).toBeVisible()
    await filters.getByRole('button', { name: 'Clear all' }).click()
    await page.keyboard.press('Escape')
    await expect(filters).toBeHidden()

    // Search (always visible above the list).
    await page.getByRole('searchbox', { name: 'Search tasks' }).fill('kettle')
    await expect(taskList(page).getByRole('listitem')).toHaveCount(1)
    await expect(row(page, 'Descale the kettle')).toBeVisible()
    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(taskList(page).getByRole('listitem')).toHaveCount(2)

    // Rename the category from the form: the row follows.
    await row(page, 'Prune the lemon tree').getByRole('button', { name: /Prune the lemon tree/ }).click()
    const edit = page.getByRole('dialog', { name: 'Edit task' })
    await edit.getByRole('button', { name: /^Category/ }).click()
    await edit.getByRole('button', { name: 'Rename or delete Garden' }).click()
    await edit.getByLabel('New name for Garden').fill('Garden & yard')
    await edit.getByRole('listbox').getByRole('button', { name: 'Save' }).click()
    await expect(edit.getByRole('button', { name: /^Category/ })).toContainText('Garden & yard')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(edit).toBeHidden()
    await expect(row(page, 'Prune the lemon tree')).toContainText('Category:Garden & yard')
  } finally {
    await deleteUser(user.email)
  }
})

test('Done tab: completed one-time tasks can be reopened', async ({ page }, testInfo) => {
  const user = newUser(`done-${testInfo.project.name}`)
  try {
    await signUpWithHousehold(page, user)
    await page.getByLabel('Quick add a task').fill('Fix bathroom faucet')
    await page.getByLabel('Quick add a task').press('Enter')
    await expect(row(page, 'Fix bathroom faucet')).toBeVisible()

    await page.getByRole('checkbox', { name: 'Complete Fix bathroom faucet' }).click()
    await expect(row(page, 'Fix bathroom faucet')).toHaveCount(0)

    const tabs = page.getByRole('group', { name: 'Show' })
    await tabs.getByRole('button', { name: /Done/ }).click()
    const done = page.getByRole('list', { name: 'Completed tasks' }).getByRole('listitem').filter({ hasText: 'Fix bathroom faucet' })
    await expect(done).toContainText('Done today')

    await page.getByRole('checkbox', { name: 'Reopen Fix bathroom faucet' }).click()
    await expect(page.getByText('No completed tasks yet')).toBeVisible()
    await tabs.getByRole('button', { name: /^All/ }).click()
    await expect(row(page, 'Fix bathroom faucet')).toBeVisible()
  } finally {
    await deleteUser(user.email)
  }
})

test('phone layout: no sideways scrolling, 44px touch targets, nav visible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone-only check')
  const user = newUser('layout')
  try {
    await signUpWithHousehold(page, user)
    // A long title and Hebrew must truncate, not widen the page.
    for (const title of ['Call the plumber about the boiler pressure valve and the leaking expansion tank', 'לקנות מנורה חדשה לסלון ולחדר השינה']) {
      await page.getByLabel('Quick add a task').fill(title)
      await page.getByLabel('Quick add a task').press('Enter')
    }
    await expect(taskList(page).getByRole('listitem')).toHaveCount(2)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    for (const target of await page.getByRole('checkbox').all()) {
      const box = await target.boundingBox()
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }

    // Bottom bar (not the sidebar) is the visible navigation.
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav).toHaveCount(1)
    const navBox = await nav.boundingBox()
    const viewport = page.viewportSize()
    expect(navBox && viewport && navBox.y + navBox.height).toBeCloseTo(viewport!.height, -1)
  } finally {
    await deleteUser(user.email)
  }
})
