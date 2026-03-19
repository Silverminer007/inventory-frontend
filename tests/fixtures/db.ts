import type { Page } from '@playwright/test'

export const TEST_IDS = {
  KELLER: '00000000-0000-0000-0000-000000000001',
  WERKZEUG_REGAL: '00000000-0000-0000-0000-000000000002',
  KLEINE_KISTE: '00000000-0000-0000-0000-000000000003',
  HAMMER: '00000000-0000-0000-0000-000000000010',
  SCHRAUBENZIEHER: '00000000-0000-0000-0000-000000000011',
} as const

export const TEST_CONTAINERS = [
  {
    id: TEST_IDS.KELLER,
    name: 'Keller',
    containerType: 'ROOM',
    parentContainerId: null,
    version: 0,
    itemCount: 2,
    totalItemCount: 3,
  },
  {
    id: TEST_IDS.WERKZEUG_REGAL,
    name: 'Werkzeug-Regal',
    containerType: 'SHELF',
    parentContainerId: TEST_IDS.KELLER,
    version: 0,
    itemCount: 1,
    totalItemCount: 1,
  },
  {
    id: TEST_IDS.KLEINE_KISTE,
    name: 'Kleine Kiste',
    containerType: 'BOX',
    parentContainerId: TEST_IDS.WERKZEUG_REGAL,
    version: 0,
    itemCount: 1,
    totalItemCount: 1,
  },
]

export const TEST_ITEMS = [
  {
    id: TEST_IDS.HAMMER,
    name: 'Hammer',
    containerId: TEST_IDS.WERKZEUG_REGAL,
    tags: ['Werkzeug'],
    quantity: 1,
    version: 1,
  },
  {
    id: TEST_IDS.SCHRAUBENZIEHER,
    name: 'Schraubenzieher',
    containerId: TEST_IDS.KLEINE_KISTE,
    tags: ['Werkzeug', 'Klein'],
    quantity: 2,
    version: 1,
  },
]

export async function seedDatabase(page: Page) {
  await page.evaluate(
    async ({ containers, items }) => {
      // Wait for __db to be available (set when useDatabase() is first called)
      let attempts = 0
      while (!(window as any).__db && attempts++ < 50) {
        await new Promise((r) => setTimeout(r, 100))
      }
      const db = (window as any).__db
      if (!db) throw new Error('__db not available — is DEV mode on?')

      await db.containers.bulkPut(containers)
      await db.items.bulkPut(items)
      await db.syncMeta.put({ key: 'lastSyncAt', value: new Date().toISOString() })
    },
    { containers: TEST_CONTAINERS, items: TEST_ITEMS },
  )
}

export async function clearDatabase(page: Page) {
  try {
    await page.evaluate(async () => {
      const db = (window as any).__db
      if (!db) return
      await Promise.all([
        db.containers.clear(),
        db.items.clear(),
        db.images.clear(),
        db.commandQueue.clear(),
        db.syncMeta.clear(),
      ])
    })
  } catch {
    // Page may have navigated away during the test — non-fatal for cleanup
  }
}

export async function getPendingCommandCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = (window as any).__db
    return db?.commandQueue.where('status').equals('PENDING').count() ?? 0
  })
}
