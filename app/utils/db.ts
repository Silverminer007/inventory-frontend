import Dexie, { type EntityTable } from 'dexie'
import type { ItemDTO, ContainerDTO } from '~/types'
import type { SyncQueueEntry } from '~/types/offline'

const db = new Dexie('inventory-db') as Dexie & {
  items: EntityTable<ItemDTO, 'id'>
  containers: EntityTable<ContainerDTO, 'id'>
  syncQueue: EntityTable<SyncQueueEntry, 'id'>
}

db.version(1).stores({
  items: '++id, name, containerId, *tags',
  containers: '++id, name, containerType, parentContainerId',
  syncQueue: '++id, entityType, entityId, operation, timestamp, status'
})

export { db }
