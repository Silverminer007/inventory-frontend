export interface ParentInfo {
  id: number
  name: string
  containerType: string
}

export interface ContainerInfo {
  type: string
  id: number
  name: string
  path: string
}

export interface ContainerDTO {
  id?: number
  name: string
  description?: string
  containerType: string
  locationType?: string
  location?: string
  position?: string
  qrCode?: string
  parentContainerId?: number | null
  lastModified?: string
  version?: number
  createdAt?: string
  locationPath?: string
  itemCount?: number
  totalItemCount?: number
  children?: ContainerDTO[]
  parent?: ParentInfo
}

export interface ItemDTO {
  id?: number
  name: string
  description?: string
  containerId?: number | null
  position?: string
  quantity: number
  barcode?: string
  qrCode?: string
  tags?: string[]
  lastModified?: string
  version?: number
  createdAt?: string
  locationPath?: string
  containerType?: string
  container?: ContainerInfo
}

export interface MoveContainerRequest {
  parentContainerId: number | null
}

export interface MoveItemRequest {
  containerId: number | null
}

export interface ImageDTO {
  id: number
  itemId?: number | null
  containerId?: number | null
  filename: string
  contentType: string
  fileSize: number
  isPrimary: boolean
  uploadedAt: string
  url: string
}
