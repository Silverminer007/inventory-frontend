import { test, expect } from '@playwright/test'
import { seedDatabase, clearDatabase } from './fixtures/db'
import { mockBackend } from './fixtures/api'

test.describe('Cache-Management', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page)
    await page.goto('/settings')
    await seedDatabase(page)
    await page.reload()
  })

  test.afterEach(async ({ page }) => { await clearDatabase(page) })

  test('zeigt korrekte Cache-Statistiken', async ({ page }) => {
    await expect(page.getByTestId('container-count')).toHaveText('3', { timeout: 5000 })
    await expect(page.getByTestId('item-count')).toHaveText('2')
  })

  test('öffnet Bestätigungs-Sheet beim Klick auf Cache leeren', async ({ page }) => {
    await page.getByRole('button', { name: /Cache leeren/i }).click()
    await expect(page.getByText('Alle lokalen Daten werden gelöscht')).toBeVisible()
  })

  test('Bestätigungs-Button ohne pending Commands direkt aktiv', async ({ page }) => {
    await page.getByRole('button', { name: /Cache leeren/i }).click()
    const confirmBtn = page.getByRole('button', { name: /Cache leeren & neu laden/i }).last()
    await expect(confirmBtn).toBeEnabled()
  })

  test('zeigt Warnung bei pending Commands', async ({ page }) => {
    // Inject a pending command
    await page.evaluate(async () => {
      const db = (window as any).__db
      await db.commandQueue.put({
        commandId: 'test-pending-cmd',
        commandType: 'ITEM_CREATE',
        payload: {},
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        entityId: null
      })
    })
    await page.reload()

    await page.getByRole('button', { name: /Cache leeren/i }).click()
    await expect(page.getByText('ungesendete')).toBeVisible()
    // Button should be disabled until checkbox is checked
    const confirmBtn = page.getByRole('button', { name: /Cache leeren & neu laden/i }).last()
    await expect(confirmBtn).toBeDisabled()
    await page.getByRole('checkbox').check()
    await expect(confirmBtn).toBeEnabled()
  })
})
