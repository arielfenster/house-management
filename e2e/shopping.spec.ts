import { expect, test, type Locator, type Page } from '@playwright/test'
import { ROUTES } from '../shared/routes'
import { signUpAndJoin, signUpWithHousehold, waitForHydration } from './support/session'
import { deleteUser, inviteCodeOf, newUser } from './support/users'

// SHOP-010: the shopping list end to end, on the phone and desktop projects: rapid entry and multi-line paste,
// sections with tick-off + undo (D22), inline edit/delete, two members in sync (realtime), reorder (desktop drag)
// and a phone layout check.

function addInput(page: Page) {
  return page.getByLabel('Add an item')
}

/** Item names in display order, per list: top area first, then sections in order. */
async function itemNames(page: Page): Promise<string[]> {
  return page.locator('li[data-id] [role=checkbox]').allTextContents().then(names => names.map(n => n.trim()))
}

function itemsOf(page: Page, section: string) {
  return page.locator('section', { has: page.getByRole('heading', { name: section, exact: true }) }).locator('li[data-id]')
}

async function openShopping(page: Page) {
  await page.goto(ROUTES.shopping)
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'Shopping', level: 1 })).toBeVisible()
}

/**
 * Drags `handle` onto a point of `target` in small mouse steps. SortableJS reacts to the drag events between press
 * and release; Playwright's one-shot `dragTo` can skip them and make the test flaky.
 */
async function drag(page: Page, handle: Locator, target: Locator, offsetY: number) {
  const from = await handle.boundingBox()
  const to = await target.boundingBox()
  if (!from || !to) {
    throw new Error('drag: element not visible')
  }
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 5, { steps: 3 })
  await page.mouse.move(to.x + 40, to.y + offsetY, { steps: 15 })
  await page.mouse.up()
}

/** Creates a section from "New section" and waits until it is saved and selected as the add target. */
async function createSection(page: Page, name: string) {
  await page.getByRole('button', { name: 'New section' }).click()
  await page.getByLabel('New section name').fill(name)
  await page.getByLabel('New section name').press('Enter')
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  await expect(page.getByLabel('Add to section').locator('option:checked')).toHaveText(name)
}

async function paste(page: Page, text: string) {
  await addInput(page).focus()
  await addInput(page).evaluate((el, value) => {
    const data = new DataTransfer()
    data.setData('text/plain', value)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, text)
}

test('rapid entry keeps the input focused; a pasted list becomes one item per line', async ({ page }, testInfo) => {
  const user = newUser(`shop-add-${testInfo.project.name}`)
  try {
    await signUpWithHousehold(page, user)
    await openShopping(page)
    await expect(page.getByText('Your list is empty')).toBeVisible()

    // Type, Enter, type, Enter… without waiting for saves.
    const input = addInput(page)
    await input.click()
    for (const name of ['Milk', 'Eggs', 'Bread', 'חלב סויה', 'Tomatoes']) {
      await input.pressSequentially(name)
      await input.press('Enter')
    }
    await expect(input).toBeFocused()
    await expect(input).toHaveValue('')
    await expect.poll(() => itemNames(page)).toEqual(['Milk', 'Eggs', 'Bread', 'חלב סויה', 'Tomatoes'])

    // Paste: markers stripped, blank lines skipped.
    await paste(page, '- Paper towels\n\n• Olive oil\n1. Salt\n')
    await expect.poll(() => itemNames(page)).toEqual(['Milk', 'Eggs', 'Bread', 'חלב סויה', 'Tomatoes', 'Paper towels', 'Olive oil', 'Salt'])
    await expect(page.getByText('8 to get')).toBeVisible()

    await page.reload()
    await expect.poll(() => itemNames(page)).toEqual(['Milk', 'Eggs', 'Bread', 'חלב סויה', 'Tomatoes', 'Paper towels', 'Olive oil', 'Salt'])
  } finally {
    await deleteUser(user.email)
  }
})

test('sections: new section becomes the target; ticking removes an item with undo', async ({ page }, testInfo) => {
  const user = newUser(`shop-sec-${testInfo.project.name}`)
  try {
    await signUpWithHousehold(page, user)
    await openShopping(page)

    await createSection(page, 'Produce')

    await addInput(page).fill('Cucumbers')
    await addInput(page).press('Enter')
    await addInput(page).fill('Lemons')
    await addInput(page).press('Enter')
    await expect(itemsOf(page, 'Produce')).toHaveCount(2)

    // Tick: the row leaves; one toast with Undo.
    await page.getByRole('checkbox', { name: 'Got Cucumbers' }).click()
    await expect(page.getByRole('checkbox', { name: 'Got Cucumbers' })).toBeHidden()
    await expect(page.getByText('✓ Cucumbers')).toBeVisible()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByRole('checkbox', { name: 'Got Cucumbers' })).toBeVisible()
    await expect(itemsOf(page, 'Produce')).toHaveCount(2)

    // Tick for real: gone after a reload too.
    await page.getByRole('checkbox', { name: 'Got Lemons' }).click()
    await expect(page.getByRole('checkbox', { name: 'Got Lemons' })).toBeHidden()
    await page.reload()
    await expect(page.getByRole('checkbox', { name: 'Got Cucumbers' })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Got Lemons' })).toHaveCount(0)

    // Rename the section; deleting it takes its items, with undo.
    await page.getByRole('button', { name: 'Edit section Produce' }).click()
    await page.getByLabel('Section name', { exact: true }).fill('Fruit & veg')
    await page.getByLabel('Section name', { exact: true }).press('Enter')
    await expect(page.getByRole('heading', { name: 'Fruit & veg', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Edit section Fruit & veg' }).click()
    await page.getByRole('button', { name: 'Delete section Fruit & veg and its items' }).click()
    await expect(page.getByText('Deleted “Fruit & veg” and 1 item')).toBeVisible()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByRole('checkbox', { name: 'Got Cucumbers' })).toBeVisible()
  } finally {
    await deleteUser(user.email)
  }
})

test('items: rename, move to a section and delete from the editor', async ({ page }, testInfo) => {
  const user = newUser(`shop-edit-${testInfo.project.name}`)
  try {
    await signUpWithHousehold(page, user)
    await openShopping(page)
    await createSection(page, 'Dairy')
    await page.getByLabel('Add to section').selectOption({ label: 'No section' })
    await addInput(page).fill('Milk 3%')
    await addInput(page).press('Enter')
    await expect(page.getByRole('checkbox', { name: 'Got Milk 3%' })).toBeVisible()

    await page.getByRole('button', { name: 'Edit Milk 3%' }).click()
    await page.getByLabel('Item name').fill('Milk 1%')
    await page.getByLabel('Item name').press('Enter')
    await expect(page.getByRole('checkbox', { name: 'Got Milk 1%' })).toBeVisible()

    await page.getByRole('button', { name: 'Edit Milk 1%' }).click()
    await page.getByRole('listitem').getByLabel('Section').selectOption({ label: 'Dairy' })
    await expect(itemsOf(page, 'Dairy')).toHaveText(['Milk 1%'])

    await page.reload()
    await expect(itemsOf(page, 'Dairy')).toHaveText(['Milk 1%'])
    await page.getByRole('button', { name: 'Edit Milk 1%' }).click()
    await page.getByRole('button', { name: 'Delete Milk 1%' }).click()
    await expect(page.getByText('Deleted “Milk 1%”')).toBeVisible()
    await expect(itemsOf(page, 'Dairy')).toHaveCount(0)
  } finally {
    await deleteUser(user.email)
  }
})

test('two members see each other’s changes without reloading', async ({ browser, page }, testInfo) => {
  const owner = newUser(`shop-a-${testInfo.project.name}`)
  const partner = newUser(`shop-b-${testInfo.project.name}`)
  const partnerContext = await browser.newContext({
    ...testInfo.project.use,
    baseURL: testInfo.project.use.baseURL,
  })
  const partnerPage = await partnerContext.newPage()
  try {
    await signUpWithHousehold(page, owner)
    await signUpAndJoin(partnerPage, partner, await inviteCodeOf(owner.email))
    await openShopping(page)
    await openShopping(partnerPage)

    // Owner adds at home; partner (in the store) sees it.
    await addInput(page).fill('Eggs')
    await addInput(page).press('Enter')
    await expect(partnerPage.getByRole('checkbox', { name: 'Got Eggs' })).toBeVisible()

    // Partner adds a section and an item; owner sees both.
    await createSection(partnerPage, 'Bakery')
    await addInput(partnerPage).fill('Pitas')
    await addInput(partnerPage).press('Enter')
    await expect(page.getByRole('heading', { name: 'Bakery', exact: true })).toBeVisible()
    await expect(itemsOf(page, 'Bakery')).toHaveText(['Pitas'])

    // Partner ticks Eggs off; it disappears for the owner too. Renames sync as well.
    await partnerPage.getByRole('checkbox', { name: 'Got Eggs' }).click()
    await expect(page.getByRole('checkbox', { name: 'Got Eggs' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Edit Pitas' }).click()
    await page.getByLabel('Item name').fill('Pitas ×10')
    await page.getByLabel('Item name').press('Enter')
    await expect(partnerPage.getByRole('checkbox', { name: 'Got Pitas ×10' })).toBeVisible()
  } finally {
    await partnerContext.close()
    await deleteUser(partner.email)
    await deleteUser(owner.email)
  }
})

test('arrange mode: drag to reorder items and move them between sections', async ({ page }, testInfo) => {
  // Touch drag is checked by hand on a phone (SHOP-010 mobile check); Playwright drives the mouse path.
  test.skip(testInfo.project.name === 'mobile', 'drag is exercised with a mouse on desktop')
  const user = newUser('shop-drag')
  try {
    await signUpWithHousehold(page, user)
    await openShopping(page)
    await createSection(page, 'Dairy')
    for (const name of ['Milk', 'Butter', 'Cheese']) {
      await addInput(page).fill(name)
      await addInput(page).press('Enter')
    }
    await expect(itemsOf(page, 'Dairy')).toHaveText(['Milk', 'Butter', 'Cheese'])

    await page.getByRole('button', { name: 'Arrange' }).click()
    // Cheese to the top of Dairy.
    await drag(page, page.getByLabel('Drag to move Cheese'), page.locator('li[data-id]', { hasText: 'Milk' }), 4)
    await expect(itemsOf(page, 'Dairy')).toHaveText(['Cheese', 'Milk', 'Butter'])
    // Butter to the "No section" area.
    await drag(page, page.getByLabel('Drag to move Butter'), page.locator('section[aria-label="Items without a section"] ul'), 20)
    await expect(itemsOf(page, 'Dairy')).toHaveText(['Cheese', 'Milk'])
    await page.getByRole('button', { name: 'Done' }).click()

    await page.reload()
    await expect(itemsOf(page, 'Dairy')).toHaveText(['Cheese', 'Milk'])
    await expect.poll(() => itemNames(page)).toEqual(['Butter', 'Cheese', 'Milk'])
  } finally {
    await deleteUser(user.email)
  }
})

test('phone layout: no sideways scroll, add bar stays in view, 44 px rows', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone only')
  const user = newUser('shop-phone')
  try {
    await signUpWithHousehold(page, user)
    await openShopping(page)
    await paste(page, Array.from({ length: 25 }, (_, i) => `Item number ${i + 1} with a fairly long name to wrap`).join('\n'))
    await expect(page.getByText('25 to get')).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(addInput(page)).toBeInViewport()

    const rowHeight = await page.locator('li[data-id]').first().evaluate(el => el.getBoundingClientRect().height)
    expect(rowHeight).toBeGreaterThanOrEqual(44)
  } finally {
    await deleteUser(user.email)
  }
})
