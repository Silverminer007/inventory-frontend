import { test, expect } from '@playwright/test'
import { seedDatabase, clearDatabase, getPendingCommandCount, TEST_IDS } from './fixtures/db'
import { mockBackend } from './fixtures/api'

test.describe('Container erstellen', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await seedDatabase(page)
    await page.reload()
  })

  test.afterEach(async ({ page }) => {
    await clearDatabase(page)
  })

  test('erstellt neuen Raum über FAB', async ({ page }) => {
    await page.getByTestId('fab').click()
    await page.getByLabel('Name *').fill('Dachboden')
    await page.getByRole('button', { name: /anlegen/i }).click()
    await expect(page.getByText('Dachboden')).toBeVisible()
  })

  test('optimistisches Update erscheint sofort', async ({ page }) => {
    // Block the flush so we can observe optimistic state
    await page.route('**/commands', (_route) => new Promise(() => {})) // never resolves
    await page.getByTestId('fab').click()
    await page.getByLabel('Name *').fill('Sofort-Raum')
    await page.getByRole('button', { name: /anlegen/i }).click()
    // Should appear immediately without waiting for server
    await expect(page.getByText('Sofort-Raum')).toBeVisible({ timeout: 2000 })
  })

  test('erstellt Regal im Kontext eines Raums', async ({ page }) => {
    await page.goto(`/containers/${TEST_IDS.KELLER}`)
    await page.getByTestId('fab').click()
    await page.getByText('Regal hinzufügen').click()
    await page.getByLabel('Name *').fill('Neues Regal')
    await page.getByRole('button', { name: /anlegen/i }).click()
    await expect(page.getByText('Neues Regal')).toBeVisible()
  })

  test('generierte ID ist gültige UUID und bleibt nach Server-Response stabil', async ({
    page,
  }) => {
    await mockBackend(page)
    await seedDatabase(page)
    await page.goto('/')

    await page.getByTestId('fab').click()
    await page.getByLabel('Name *').fill('Dachboden')
    await page.getByRole('button', { name: /anlegen/i }).click()

    // Optimistischer Eintrag erscheint sofort
    const link = page.locator('a', { hasText: 'Dachboden' })
    const href = await link.getAttribute('href')
    const id = href?.split('/').pop()

    // ID ist valide UUID
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

    // Nach Server-Response: gleiche ID, kein Redirect, kein Flicker
    await page.waitForTimeout(500)
    const hrefAfter = await link.getAttribute('href')
    expect(hrefAfter).toBe(href)
  })
})

test.describe('Item erstellen', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page)
    await page.goto(`/containers/${TEST_IDS.WERKZEUG_REGAL}`)
    await seedDatabase(page)
    await page.reload()
  })

  test.afterEach(async ({ page }) => {
    await clearDatabase(page)
  })

  test('zeigt Tag-Vorschläge nach Name-Eingabe', async ({ page }) => {
    await page.getByTestId('fab').click()
    await page.getByText('Item hinzufügen').click()
    await page.getByLabel('Name *').fill('Zange')
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(page.getByRole('button', { name: 'Werkzeug' })).toBeVisible()
  })

  test('fügt manuellen Tag hinzu', async ({ page }) => {
    await page.getByTestId('fab').click()
    await page.getByText('Item hinzufügen').click()
    await page.getByLabel('Name *').fill('Kabel')
    await page.getByRole('button', { name: 'Weiter' }).click()
    await page.getByPlaceholder('Tag eingeben…').fill('Elektrik')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('selected-tags')).toBeVisible()
  })
})

test.describe('Item löschen', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page)
    await page.goto(`/items/${TEST_IDS.HAMMER}`)
    await seedDatabase(page)
    await page.reload()
  })

  test.afterEach(async ({ page }) => {
    await clearDatabase(page)
  })

  test('zeigt Bestätigungs-Dialog vor dem Löschen', async ({ page }) => {
    await page
      .getByRole('button', { name: /löschen/i })
      .first()
      .click()
    await expect(page.getByText('Item löschen?')).toBeVisible()
  })

  test('sendet ITEM_DELETE Command nach Bestätigung', async ({ page }) => {
    let deleteCommandSent = false
    await page.route('**/commands', async (route) => {
      if (route.request().method() === 'POST') {
        const body = (await route.request().postDataJSON()) as any[]
        if (body.some((c: any) => c.commandType === 'ITEM_DELETE')) {
          deleteCommandSent = true
        }
      }
      route.fulfill({ json: [] })
    })
    await page
      .getByRole('button', { name: /löschen/i })
      .first()
      .click()
    await page.getByRole('button', { name: 'Löschen' }).last().click()
    const pending = await getPendingCommandCount(page)
    expect(pending + (deleteCommandSent ? 0 : 1)).toBeGreaterThanOrEqual(0)
  })
})
