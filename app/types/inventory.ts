import type { UUID } from '~/utils/uuid'

// ─── Server-side DTOs (API shapes) ────────────────────────────────────────────

export interface ParentInfo {
  id: UUID
  name: string
  containerType: string
}

export interface ContainerInfo {
  type: string
  id: UUID
  name: string
  path: string
}

/** Returned by GET /api/v1/containers and snapshot in CommandResultDTO */
export interface Container {
  id: UUID
  name: string
  containerType: 'ROOM' | 'SHELF' | 'BOX'
  description?: string | null
  position?: string | null
  location?: string | null
  qrCode?: string | null
  parentContainerId?: UUID | null
  lastModified?: string | null
  version: number
  createdAt?: string | null
  locationPath?: string | null
  itemCount?: number
  totalItemCount?: number
  children?: Container[] | null
  parent?: ParentInfo | null
}

/** Tag with type info — stored locally, tags[] in server DTOs are plain strings */
export interface ItemTag {
  tag: string
  tagType: 'LLM' | 'RULE' | 'MANUAL'
}

/** Image returned by GET /api/v1/items/{id}/images */
export interface Image {
  id: UUID
  itemId?: UUID | null
  containerId?: UUID | null
  filename: string
  contentType: string
  fileSize: number
  isPrimary: boolean
  uploadedAt: string
  url: string
}

/** Returned by GET /api/v1/items */
export interface Item {
  id: UUID
  name: string
  containerId?: UUID | null
  description?: string | null
  quantity: number
  barcode?: string | null
  qrCode?: string | null
  position?: string | null
  tags?: string[]
  lastModified?: string | null
  version: number
  createdAt?: string | null
  locationPath?: string | null
  containerType?: string | null
  container?: ContainerInfo | null
}

// ─── Event-Sourcing / Command DTOs ────────────────────────────────────────────

export type CommandType =
  | 'ITEM_CREATE'
  | 'ITEM_UPDATE'
  | 'ITEM_DELETE'
  | 'ITEM_MOVE'
  | 'CONTAINER_CREATE'
  | 'CONTAINER_UPDATE'
  | 'CONTAINER_DELETE'
  | 'CONTAINER_MOVE'
  | 'IMAGE_UPLOAD'
  | 'IMAGE_SET_PRIMARY'
  | 'IMAGE_DELETE'

export type EntityType = 'ITEM' | 'CONTAINER' | 'IMAGE'

export type CommandStatus = 'APPLIED' | 'FAILED' | 'CONFLICT'

export interface CommandDTO {
  commandId: UUID
  commandType: CommandType
  payloadVersion: 1
  entityId?: UUID | null
  entityType?: EntityType
  payload: Record<string, unknown>
  clientId?: string | null
  issuedAt: string
}

export interface ConflictInfo {
  clientVersion: number
  serverVersion: number
  conflictingFields: string[]
  serverSnapshot: Record<string, unknown>
  clientPayload: Record<string, unknown>
}

export interface CommandResultDTO {
  commandId: UUID
  status: CommandStatus
  entityId?: UUID | null
  entityType?: EntityType | null
  serverSequence?: number | null
  appliedAt?: string | null
  snapshot?: Container | Item | Image | null
  error?: string | null
  conflictInfo?: ConflictInfo | null
}

/** Shape returned by GET `/api/v1/commands`?since=... */
export interface AppliedCommandDTO {
  commandId: UUID
  commandType: CommandType
  payloadVersion: 1
  entityType: EntityType
  entityId: UUID
  payload: Record<string, unknown>
  clientId?: string | null
  clientSequence?: number | null
  issuedAt: string
  appliedAt: string
  serverSequence: number
}

// ─── Local command queue (Dexie) ──────────────────────────────────────────────

export type QueueStatus = 'PENDING' | 'SENT' | 'APPLIED' | 'FAILED' | 'CONFLICT'

export interface CommandQueueEntry {
  commandId: UUID
  commandType: CommandType
  payload: Record<string, unknown>
  status: QueueStatus
  createdAt: string
  entityId?: UUID | null
  conflictInfo?: ConflictInfo | null
  error?: string | null
}

export interface SyncMeta {
  key: string
  value: string
}

// ─── Local enriched item for Dexie (stores tags with type info) ───────────────

export interface LocalItem extends Item {
  enrichedTags?: ItemTag[]
}

// ─── Pending image (queued for upload) ────────────────────────────────────────

export interface PendingImage {
  id?: number
  entityType: 'item' | 'container'
  entityId: UUID
  blob: Blob
  filename: string
  isPrimary: boolean
  createdAt: string
}
