import { useDatabase } from '~/composables/useDatabase'
import { getBreadcrumb } from '~/utils/containerUtils'
import type { Container, LocalItem } from '~/types/inventory'

export interface SearchResult {
  item?: LocalItem
  container?: Container
  breadcrumb: { id: string; name: string; type: string }[]
}

// Module-level index — shared across all composable instances
let allContainersCache: Container[] = []

export async function useCategoryHarmonizer() {
  const db = useDatabase()
  allContainersCache = await db.getAllContainers()

  function search(): SearchResult[] {
    let containerResults: SearchResult[] = []

    // Fuzzy search in both indexes
    containerResults = allContainersCache
      .filter(async (r) => {
        const categories = new Set()
        for (const childContainer in r?.children as Container[]) {
          categories.add(childContainer)
        }
        for (const childItem in (await db.getItemsByContainer(r.id)) as LocalItem[]) {
          categories.add(childItem.category)
        }
        return categories.size > 1
      })
      .map((r) => ({
        type: 'container' as const,
        container: r,
        breadcrumb: r.parentContainerId
          ? getBreadcrumb(r.parentContainerId, allContainersCache)
          : [],
      }))
    // Merge and sort by score (lower = better)
    return containerResults
  }

  return { search }
}
