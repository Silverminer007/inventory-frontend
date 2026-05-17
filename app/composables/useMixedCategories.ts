import { useDatabase } from '~/composables/useDatabase'
import { getBreadcrumb } from '~/utils/containerUtils'
import type { Container } from '~/types/inventory'

export interface CategoryConflict {
  container?: Container
  categoryCount: number
  breadcrumb: { id: string; name: string; type: string }[]
}

// Module-level index — shared across all composable instances
let containersCache: Container[] = []

export async function useMixedCategories() {
  const db = useDatabase()
  containersCache = await db.getAllContainers()

  async function findConflicts(): Promise<CategoryConflict[]> {
    let conflicts: CategoryConflict[] = []

    for (let i = 0; i < containersCache.length; i++) {
      const container = containersCache[i]
      if (!container) {
        continue
      }
      const categories = new Set<string>()

      const childContainers = container.children || []
      for (const childContainer of childContainers) {
        const cat = childContainer.primaryCategory?.shortCode
        if (cat) {
          categories.add(cat)
        }
      }
      const childItems = (await db.getItemsByContainer(container.id)) || []
      for (const childItem of childItems) {
        const cat = childItem.category?.shortCode
        if (cat) {
          categories.add(cat)
        }
      }

      if (categories.size <= 1) {
        continue
      }
      conflicts.push({
        container,
        categoryCount: categories.size,
        breadcrumb: container.parentContainerId
          ? getBreadcrumb(container.parentContainerId, containersCache)
          : [],
      } as CategoryConflict)
    }
    conflicts = conflicts.sort((a, b) => b.categoryCount - a.categoryCount)
    return conflicts
  }

  return { findConflicts }
}
