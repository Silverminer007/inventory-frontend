import { test, expect } from '@playwright/test'
import { seedDatabase, clearDatabase } from './fixtures/db'
import { mockBackend } from './fixtures/api'

test.describe('Fuzzy-Suche', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page)
    await page.goto('/search')
    await seedDatabase(page)
    await page.reload()
  })

  test.afterEach(async ({ page }) => { await clearDatabase(page) })

  test('findet Item bei exaktem Match', async ({ page }) => {
    await page.getByTestId('search-input').fill('Hammer')
    await expect(page.getByText('Hammer')).toBeVisible({ timeout: 3000 })
  })

  test('findet Item bei Tippfehler (Fuzzy)', async ({ page }) => {
    await page.getByTestId('search-input').fill('Hamr')
    await expect(page.getByText('Hammer')).toBeVisible({ timeout: 3000 })
  })

  test('hebt Treffer im Ergebnis hervor', async ({ page }) => {
    await page.getByTestId('search-input').fill('Hammer')
    await expect(page.locator('mark.search-highlight')).toBeVisible({ timeout: 3000 })
  })

  test('zeigt EmptyState bei zu schlechtem Match', async ({ page }) => {
    await page.getByTestId('search-input').fill('xyzxyzxyz')
    await expect(page.getByTestId('empty-state')).toBeVisible({ timeout: 3000 })
  })

  test('findet Container bei Suche', async ({ page }) => {
    await page.getByTestId('search-input').fill('Keller')
    await expect(page.getByText('Keller').first()).toBeVisible({ timeout: 3000 })
  })
})

test.describe('Tag-Filter', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page)
    await page.goto('/search')
    await seedDatabase(page)
    await page.reload()
  })

  test.afterEach(async ({ page }) => { await clearDatabase(page) })

  test('zeigt Tag-Filter-Button', async ({ page }) => {
    await expect(page.getByTestId('filter-button')).toBeVisible()
  })

  test('öffnet Tag-Filter-Sheet', async ({ page }) => {
    await page.getByTestId('filter-button').click()
    await expect(page.getByTestId('tag-filter')).toBeVisible()
  })

  test('zeigt Anzahl aktiver Filter als Badge', async ({ page }) => {
    await page.getByTestId('filter-button').click()
    // Werkzeug is a tag in TEST_ITEMS — click it in suggestions after TagFilter loads
    await page.getByTestId('tag-search-input').fill('Werkzeug')
    // Click the suggestion
    const suggestion = page.getByRole('button', { name: /Werkzeug/ }).first()
    await suggestion.click()
    await page.getByRole('button', { name: 'Filter anwenden' }).click()
    // Badge should show count
    await expect(page.getByTestId('filter-button')).toContainText('1')
  })

  test('entfernt Tag-Filter per X auf Chip', async ({ page }) => {
    // Add a tag filter first
    await page.getByTestId('filter-button').click()
    await page.getByTestId('tag-search-input').fill('Werkzeug')
    await page.getByRole('button', { name: /Werkzeug/ }).first().click()
    await page.getByRole('button', { name: 'Filter anwenden' }).click()
    // Now remove it via chip
    const chip = page.locator('[data-testid="filter-button"] ~ * button', { hasText: 'Werkzeug' }).first()
    await chip.click()
    await expect(page.getByTestId('filter-button')).not.toContainText('1')
  })
})
