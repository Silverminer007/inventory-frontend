import type { UUID } from '~/utils/uuid'
import type { Container } from '~/types/inventory'

export const containerConfig = {
  ROOM: { label: 'Raum', icon: 'mdi:home-outline', color: 'blue' },
  SHELF: { label: 'Regal', icon: 'mdi:bookshelf', color: 'green' },
  BOX: { label: 'Kiste', icon: 'mdi:package-variant-closed', color: 'amber' }
} as const

export type ContainerType = keyof typeof containerConfig

/** Returns the full ancestor chain from root to the given container (inclusive) */
export function getContainerPath(containerId: UUID, allContainers: Container[]): Container[] {
  const map = new Map(allContainers.map(c => [c.id, c]))
  const path: Container[] = []
  let current = map.get(containerId)

  while (current) {
    path.unshift(current)
    current = current.parentContainerId ? map.get(current.parentContainerId) : undefined
  }

  return path
}

/** Returns breadcrumb items (id, name, type) from root to container */
export function getBreadcrumb(
  containerId: UUID,
  allContainers: Container[]
): Array<{ id: UUID; name: string; type: ContainerType }> {
  return getContainerPath(containerId, allContainers).map(c => ({
    id: c.id,
    name: c.name,
    type: c.containerType as ContainerType
  }))
}

/** Returns the child container type for a given parent type */
export function getChildType(parentType: ContainerType): ContainerType {
  if (parentType === 'ROOM') return 'SHELF'
  return 'BOX'
}

/** Returns valid child container types for an "Add" action */
export function getAddableChildTypes(parentType: ContainerType): ContainerType[] {
  if (parentType === 'ROOM') return ['SHELF']
  return ['BOX']
}
