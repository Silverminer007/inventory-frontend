import { test, expect } from '@playwright/test'
import { seedDatabase, clearDatabase } from './fixtures/db'
import { mockBackend } from './fixtures/api'

test.describe('Offline-Verhalten', () => {
  test('App ist nach initialem Sync offline nutzbar', async ({ page, context }) => {
    await mockBackend(page)
    await page.goto('/')
    await seedDatabase(page)
    await page.reload()

    await expect(page.getByText('Keller')).toBeVisible()

    await context.setOffline(true)
    await page.reload()

    await expect(page.getByText('Keller')).toBeVisible()
    await clearDatabase(page)
  })

  test('Commands werden in Queue gespeichert wenn offline', async ({ page, context }) => {
    await mockBackend(page)
    await page.goto('/')
    await seedDatabase(page)
    await page.reload()

    await context.setOffline(true)
    await page.getByTestId('fab').click()
    await page.getByLabel('Name *').fill('Offline-Raum')
    await page.getByRole('button', { name: /anlegen/i }).click()
    await expect(page.getByText('Offline-Raum')).toBeVisible()

    const pending = await page.evaluate(async () => {
      const db = (window as any).__db
      return db?.commandQueue.where('status').equals('PENDING').count() ?? 0
    })
    expect(pending).toBeGreaterThan(0)

    await context.setOffline(false)
    await clearDatabase(page)
  })
})

test.describe('Sync-Status-Indikator', () => {
  test('zeigt Sync-Status-Element', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await seedDatabase(page)
    await page.reload()
    await expect(page.getByTestId('sync-status')).toBeVisible()
    await clearDatabase(page)
  })
})
