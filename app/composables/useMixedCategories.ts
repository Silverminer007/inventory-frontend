import { useDatabase } from '~/composables/useDatabase'
import { getBreadcrumb, type ContainerType } from '~/utils/containerUtils'
import type { UUID } from '~/utils/uuid'
import type { Container } from '~/types/inventory'

export interface CategoryConflict {
  container: Container
  categoryCount: number
  breadcrumb: { id: UUID; name: string; type: ContainerType }[]
}

export function useMixedCategories() {
  const db = useDatabase()

  async function findConflicts(): Promise<CategoryConflict[]> {
    const containers = await db.getAllContainers()
    const conflicts: CategoryConflict[] = []

    for (const container of containers) {
      const categories = new Set<string>()

      for (const childContainer of container.children || []) {
        const cat = childContainer.primaryCategory?.shortCode
        if (cat) categories.add(cat)
      }

      const childItems = await db.getItemsByContainer(container.id)
      for (const childItem of childItems) {
        const cat = childItem.category?.shortCode
        if (cat) categories.add(cat)
      }

      if (categories.size <= 1) continue

      conflicts.push({
        container,
        categoryCount: categories.size,
        breadcrumb: container.parentContainerId
          ? getBreadcrumb(container.parentContainerId, containers)
          : [],
      })
    }

    return conflicts.sort((a, b) => b.categoryCount - a.categoryCount)
  }

  return { findConflicts }
}
