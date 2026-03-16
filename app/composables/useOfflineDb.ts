import { db } from '~/utils/db'
import type { ItemDTO, ContainerDTO } from '~/types'
import type { SyncQueueEntry } from '~/types/offline'

export function useOfflineDb() {
  // Items
  async function getItems(): Promise<ItemDTO[]> {
    return await db.items.toArray()
  }

  async function getItemById(id: number): Promise<ItemDTO | undefined> {
    return await db.items.get(id)
  }

  async function saveItem(item: ItemDTO): Promise<void> {
    await db.items.put(item)
  }

  async function saveItems(items: ItemDTO[]): Promise<void> {
    await db.items.bulkPut(items)
  }

  async function deleteItem(id: number): Promise<void> {
    await db.items.delete(id)
  }

  // Containers
  async function getContainers(): Promise<ContainerDTO[]> {
    return await db.containers.toArray()
  }

  async function getContainerById(id: number): Promise<ContainerDTO | undefined> {
    return await db.containers.get(id)
  }

  async function getContainerChildren(parentId: number): Promise<ContainerDTO[]> {
    return await db.containers.where('parentContainerId').equals(parentId).toArray()
  }

  async function getRootContainers(): Promise<ContainerDTO[]> {
    return await db.containers
      .filter(c => c.parentContainerId === null || c.parentContainerId === undefined)
      .toArray()
  }

  async function saveContainer(container: ContainerDTO): Promise<void> {
    await db.containers.put(container)
  }

  async function saveContainers(containers: ContainerDTO[]): Promise<void> {
    await db.containers.bulkPut(containers)
  }

  async function deleteContainer(id: number): Promise<void> {
    await db.containers.delete(id)
  }

  // Sync Queue
  async function addToSyncQueue(entry: Omit<SyncQueueEntry, 'id'>): Promise<number> {
    const id = await db.syncQueue.add(entry as SyncQueueEntry)
    return id!
  }

  async function getPendingSyncEntries(): Promise<SyncQueueEntry[]> {
    return await db.syncQueue.where('status').equals('pending').toArray()
  }

  async function getAllSyncEntries(): Promise<SyncQueueEntry[]> {
    return await db.syncQueue.orderBy('timestamp').toArray()
  }

  async function updateSyncEntryStatus(id: number, status: SyncQueueEntry['status']): Promise<void> {
    await db.syncQueue.update(id, { status })
  }

  async function removeSyncEntry(id: number): Promise<void> {
    await db.syncQueue.delete(id)
  }

  async function clearSyncQueue(): Promise<void> {
    await db.syncQueue.clear()
  }

  return {
    // Items
    getItems,
    getItemById,
    saveItem,
    saveItems,
    deleteItem,
    // Containers
    getContainers,
    getContainerById,
    getContainerChildren,
    getRootContainers,
    saveContainer,
    saveContainers,
    deleteContainer,
    // Sync Queue
    addToSyncQueue,
    getPendingSyncEntries,
    getAllSyncEntries,
    updateSyncEntryStatus,
    removeSyncEntry,
    clearSyncQueue
  }
}
