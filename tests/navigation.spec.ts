import { test, expect } from '@playwright/test'
import { seedDatabase, clearDatabase, TEST_IDS } from './fixtures/db'
import { mockBackend } from './fixtures/api'

test.describe('Container-Hierarchie', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
    await seedDatabase(page)
    await page.reload()
  })

  test.afterEach(async ({ page }) => {
    await clearDatabase(page)
  })

  test('zeigt alle Root-Container auf Startseite', async ({ page }) => {
    await expect(page.getByText('Keller')).toBeVisible()
  })

  test('navigiert in Container und zeigt Kinder', async ({ page }) => {
    await page.getByText('Keller').click()
    await expect(page.getByText('Werkzeug-Regal')).toBeVisible()
  })

  test('zeigt Breadcrumb beim Navigieren', async ({ page }) => {
    await page.goto(`/containers/${TEST_IDS.WERKZEUG_REGAL}`)
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(breadcrumb).toContainText('Keller')
  })

  test('zeigt direkten Inhalt eines Containers', async ({ page }) => {
    await page.goto(`/containers/${TEST_IDS.WERKZEUG_REGAL}`)
    await expect(page.getByText('Kleine Kiste')).toBeVisible()
    await expect(page.getByText('Hammer')).toBeVisible()
    // Schraubenzieher ist in der Kiste, nicht direkt im Regal
    await expect(page.getByText('Schraubenzieher')).not.toBeVisible()
  })

  test('zeigt vollständigen Pfad im Breadcrumb', async ({ page }) => {
    await page.goto(`/containers/${TEST_IDS.KLEINE_KISTE}`)
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(breadcrumb).toContainText('Keller')
    await expect(breadcrumb).toContainText('Werkzeug-Regal')
  })
})
