import Dexie, { type EntityTable } from 'dexie'
import type { ItemDTO, ContainerDTO } from '~/types'
import type { SyncQueueEntry } from '~/types/offline'

type InventoryDB = Dexie & {
  items: EntityTable<ItemDTO, 'id'>
  containers: EntityTable<ContainerDTO, 'id'>
  syncQueue: EntityTable<SyncQueueEntry, 'id'>
}

let _db: InventoryDB | null = null

function createDb(): InventoryDB {
  const instance = new Dexie('inventory-db') as InventoryDB
  instance.version(1).stores({
    items: '++id, name, containerId, *tags',
    containers: '++id, name, containerType, parentContainerId',
    syncQueue: '++id, entityType, entityId, operation, timestamp, status'
  })
  return instance
}

export const db: InventoryDB = new Proxy({} as InventoryDB, {
  get(_target, prop, receiver) {
    if (!_db) {
      _db = createDb()
    }
    return Reflect.get(_db, prop, receiver)
  }
})
