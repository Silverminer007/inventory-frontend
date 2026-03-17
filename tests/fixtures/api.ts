import type { Page } from '@playwright/test'
import { TEST_CONTAINERS, TEST_ITEMS } from './db'

export async function mockBackend(page: Page) {
  // Block real sync on first load (return empty command log)
  await page.route('**/commands', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: [] })
    }
    // POST: echo commands back as APPLIED
    // Entity UUID comes from the client — just mirror it back
    const body = await route.request().postDataJSON() as any[]
    return route.fulfill({
      json: body.map((cmd: any) => ({
        commandId: cmd.commandId,
        status: 'APPLIED',
        entityId: cmd.entityId,
        entityType: cmd.commandType.startsWith('ITEM') ? 'ITEM' : 'CONTAINER',
        serverSequence: Date.now(),
        appliedAt: new Date().toISOString(),
        snapshot: { ...cmd.payload, id: cmd.entityId },
        error: null,
        conflictInfo: null
      }))
    })
  })

  // Return test data for initial sync
  await page.route('**/api/v1/containers', route =>
    route.fulfill({ json: TEST_CONTAINERS })
  )
  await page.route('**/api/v1/items', route =>
    route.fulfill({ json: TEST_ITEMS })
  )
  await page.route('**/api/v1/items/search**', route =>
    route.fulfill({ json: [] })
  )
  await page.route('**/api/v1/items/tags**', route =>
    route.fulfill({ json: [] })
  )
  // Registered after the general tags route so it takes precedence (Playwright LIFO matching)
  await page.route('**/api/v1/items/tags/suggest**', route =>
    route.fulfill({ json: ['Werkzeug', 'Metall', 'Klein'] })
  )
  await page.route('**/api/v1/**images**', route =>
    route.fulfill({ json: [] })
  )
}
