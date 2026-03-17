import Dexie, { type Table } from 'dexie'
import type { UUID } from '~/utils/uuid'
import type {
  Container,
  LocalItem,
  Image,
  CommandQueueEntry,
  SyncMeta,
  PendingImage
} from '~/types/inventory'

class InventoryDatabase extends Dexie {
  containers!: Table<Container, UUID>
  items!: Table<LocalItem, UUID>
  images!: Table<Image, UUID>
  commandQueue!: Table<CommandQueueEntry, UUID>
  syncMeta!: Table<SyncMeta, string>
  pendingImages!: Table<PendingImage, number>

  constructor() {
    super('lager-db')

    this.version(1).stores({
      containers: 'id, containerType, parentContainerId, name',
      items: 'id, containerId, name, *tags',
      images: 'id, itemId, containerId',
      commandQueue: '++localId, commandId, status, createdAt',
      syncMeta: 'key'
    })

    this.version(2).stores({
      pendingImages: '++id, entityId'
    })

    // UUID migration: PK types change from number → string; clear all data
    this.version(3).stores({
      containers: 'id, containerType, parentContainerId, name',
      items: 'id, containerId, name, *tags',
      images: 'id, itemId, containerId',
      commandQueue: 'commandId, status, createdAt',
      pendingImages: '++id, entityId',
      syncMeta: 'key'
    }).upgrade(tx => {
      return Promise.all([
        tx.table('containers').clear(),
        tx.table('items').clear(),
        tx.table('images').clear(),
        tx.table('commandQueue').clear(),
        tx.table('syncMeta').clear()
      ])
    })
  }
}

// Singleton instance
let dbInstance: InventoryDatabase | null = null

export function useDatabase() {
  if (!dbInstance) {
    dbInstance = new InventoryDatabase()
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__db = dbInstance
    }
  }

  const db = dbInstance

  // ─── Containers ─────────────────────────────────────────────────────────────

  async function getRootContainers(): Promise<Container[]> {
    return db.containers
      .filter(c => c.parentContainerId === null || c.parentContainerId === undefined)
      .toArray()
  }

  async function getContainer(id: UUID): Promise<Container | undefined> {
    return db.containers.get(id)
  }

  async function getContainerChildren(parentId: UUID): Promise<Container[]> {
    return db.containers.where('parentContainerId').equals(parentId).toArray()
  }

  async function getAllContainers(): Promise<Container[]> {
    return db.containers.toArray()
  }

  async function upsertContainer(container: Container): Promise<void> {
    await db.containers.put(container)
  }

  async function upsertContainers(containers: Container[]): Promise<void> {
    await db.containers.bulkPut(containers)
  }

  async function deleteContainer(id: UUID): Promise<void> {
    await db.containers.delete(id)
  }

  // ─── Items ───────────────────────────────────────────────────────────────────

  async function getItem(id: UUID): Promise<LocalItem | undefined> {
    return db.items.get(id)
  }

  async function getItemsByContainer(containerId: UUID): Promise<LocalItem[]> {
    return db.items.where('containerId').equals(containerId).toArray()
  }

  async function getAllItems(): Promise<LocalItem[]> {
    return db.items.toArray()
  }

  async function upsertItem(item: LocalItem): Promise<void> {
    await db.items.put(item)
  }

  async function upsertItems(items: LocalItem[]): Promise<void> {
    await db.items.bulkPut(items)
  }

  async function deleteItem(id: UUID): Promise<void> {
    await db.items.delete(id)
  }

  async function searchItems(query: string): Promise<LocalItem[]> {
    const q = query.toLowerCase()
    return db.items
      .filter(item => {
        if (item.name.toLowerCase().includes(q)) return true
        if (item.description?.toLowerCase().includes(q) === true) return true
        if (item.tags?.some(t => t.toLowerCase().includes(q)) === true) return true
        return false
      })
      .toArray()
  }

  // ─── Images ──────────────────────────────────────────────────────────────────

  async function getImagesForItem(itemId: UUID): Promise<Image[]> {
    return db.images.where('itemId').equals(itemId).toArray()
  }

  async function getImagesForContainer(containerId: UUID): Promise<Image[]> {
    return db.images.where('containerId').equals(containerId).toArray()
  }

  async function upsertImage(image: Image): Promise<void> {
    await db.images.put(image)
  }

  async function deleteImage(id: UUID): Promise<void> {
    await db.images.delete(id)
  }

  // ─── Pending Images ───────────────────────────────────────────────────────────

  async function addPendingImage(img: Omit<PendingImage, 'id'>): Promise<number> {
    return db.pendingImages.add(img as PendingImage)
  }

  async function getPendingImagesForEntity(entityType: 'item' | 'container', entityId: UUID): Promise<PendingImage[]> {
    return db.pendingImages
      .where('entityId').equals(entityId)
      .filter(i => i.entityType === entityType)
      .toArray()
  }

  async function deletePendingImage(id: number): Promise<void> {
    await db.pendingImages.delete(id)
  }

  async function remapPendingImages(entityType: 'item' | 'container', oldEntityId: UUID, newEntityId: UUID): Promise<void> {
    const imgs = await getPendingImagesForEntity(entityType, oldEntityId)
    for (const img of imgs) {
      if (img.id !== undefined) await db.pendingImages.update(img.id, { entityId: newEntityId })
    }
  }

  // ─── Command Queue ────────────────────────────────────────────────────────────

  async function enqueuCommand(entry: CommandQueueEntry): Promise<UUID> {
    await db.commandQueue.put(entry)
    return entry.commandId
  }

  async function getPendingCommands(): Promise<CommandQueueEntry[]> {
    return db.commandQueue.where('status').equals('PENDING').toArray()
  }

  async function updateCommandStatus(
    commandId: UUID,
    status: CommandQueueEntry['status'],
    extras?: Partial<CommandQueueEntry>
  ): Promise<void> {
    await db.commandQueue.update(commandId, { status, ...extras })
  }

  async function getCommandQueueCount(status?: CommandQueueEntry['status']): Promise<number> {
    if (status) {
      return db.commandQueue.where('status').equals(status).count()
    }
    return db.commandQueue.count()
  }

  async function getRecentCommands(limit = 20): Promise<CommandQueueEntry[]> {
    const all = await db.commandQueue.orderBy('createdAt').reverse().limit(limit).toArray()
    return all
  }

  async function getConflictedCommands(): Promise<CommandQueueEntry[]> {
    return db.commandQueue.where('status').equals('CONFLICT').toArray()
  }

  async function deleteCommand(commandId: UUID): Promise<void> {
    await db.commandQueue.delete(commandId)
  }

  // ─── Sync Meta ────────────────────────────────────────────────────────────────

  async function getSyncMeta(key: string): Promise<string | null> {
    const entry = await db.syncMeta.get(key)
    return entry?.value ?? null
  }

  async function setSyncMeta(key: string, value: string): Promise<void> {
    await db.syncMeta.put({ key, value })
  }

  async function isDbEmpty(): Promise<boolean> {
    const containerCount: number = await db.containers.count()
    const itemCount: number = await db.items.count()
    return containerCount === 0 && itemCount === 0
  }

  return {
    db,
    // containers
    getRootContainers,
    getContainer,
    getContainerChildren,
    getAllContainers,
    upsertContainer,
    upsertContainers,
    deleteContainer,
    // items
    getItem,
    getItemsByContainer,
    getAllItems,
    upsertItem,
    upsertItems,
    deleteItem,
    searchItems,
    // images
    getImagesForItem,
    getImagesForContainer,
    upsertImage,
    deleteImage,
    // pending images
    addPendingImage,
    getPendingImagesForEntity,
    deletePendingImage,
    remapPendingImages,
    // command queue
    enqueuCommand,
    getPendingCommands,
    updateCommandStatus,
    getCommandQueueCount,
    getRecentCommands,
    getConflictedCommands,
    deleteCommand,
    // sync meta
    getSyncMeta,
    setSyncMeta,
    isDbEmpty
  }
}
