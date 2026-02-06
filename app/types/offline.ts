export interface SyncQueueEntry {
  id?: number
  entityType: 'item' | 'container'
  entityId: number | string
  operation: 'create' | 'update' | 'delete' | 'move'
  payload: Record<string, any>
  timestamp: Date
  status: 'pending' | 'syncing' | 'failed'
  retryCount: number
}
