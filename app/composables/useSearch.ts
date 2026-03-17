import Fuse, { type FuseResultMatch } from 'fuse.js'
import { useDatabase } from '~/composables/useDatabase'
import { getBreadcrumb } from '~/utils/containerUtils'
import type { LocalItem, Container } from '~/types/inventory'

export interface SearchResult {
  type: 'item' | 'container'
  item?: LocalItem
  container?: Container
  score: number
  matches?: readonly FuseResultMatch[]
  breadcrumb: { id: string; name: string; type: string }[]
}

// Module-level index — shared across all composable instances
let itemFuse: Fuse<LocalItem> | null = null
let containerFuse: Fuse<Container> | null = null
let allItemsCache: LocalItem[] = []
let allContainersCache: Container[] = []
let indexBuilt = false

export function useSearch() {
  const db = useDatabase()

  async function buildIndex(): Promise<void> {
    const [items, containers] = await Promise.all([
      db.getAllItems(),
      db.getAllContainers()
    ])

    allItemsCache = items
    allContainersCache = containers

    itemFuse = new Fuse(items, {
      keys: [
        { name: 'name', weight: 0.6 },
        { name: 'description', weight: 0.2 },
        { name: 'tags', weight: 0.2 },
        { name: 'barcode', weight: 0.1 }
      ],
      threshold: 0.35,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      ignoreLocation: true
    })

    containerFuse = new Fuse(containers, {
      keys: [
        { name: 'name', weight: 0.7 },
        { name: 'description', weight: 0.3 }
      ],
      threshold: 0.35,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      ignoreLocation: true
    })

    indexBuilt = true
  }

  async function ensureIndex(): Promise<void> {
    if (!indexBuilt || allItemsCache.length === 0) await buildIndex()
  }

  async function refreshIndex(): Promise<void> {
    indexBuilt = false
    await buildIndex()
  }

  function search(query: string, activeTags: string[]): SearchResult[] {
    if (!itemFuse || !containerFuse) return []
    if (!query.trim() && activeTags.length === 0) return []

    let itemResults: SearchResult[] = []
    let containerResults: SearchResult[] = []

    if (query.trim().length >= 2) {
      // Fuzzy search in both indexes
      const rawItems = itemFuse.search(query)
      const rawContainers = containerFuse.search(query)

      itemResults = rawItems.map(r => ({
        type: 'item' as const,
        item: r.item,
        score: r.score ?? 1,
        matches: r.matches,
        breadcrumb: r.item.containerId
          ? getBreadcrumb(r.item.containerId, allContainersCache)
          : []
      }))

      containerResults = rawContainers.map(r => ({
        type: 'container' as const,
        container: r.item,
        score: r.score ?? 1,
        matches: r.matches,
        breadcrumb: r.item.parentContainerId
          ? getBreadcrumb(r.item.parentContainerId, allContainersCache)
          : []
      }))
    } else if (activeTags.length > 0) {
      // Tag-only filter: scan the cached items array directly
      return allItemsCache
        .filter(item => activeTags.every(tag => item.tags?.includes(tag)))
        .map(item => ({
          type: 'item' as const,
          item,
          score: 0,
          matches: undefined,
          breadcrumb: item.containerId
            ? getBreadcrumb(item.containerId, allContainersCache)
            : []
        }))
    }

    // Apply tag filter on top of fuzzy results
    if (activeTags.length > 0) {
      itemResults = itemResults.filter(r =>
        activeTags.every(tag => r.item?.tags?.includes(tag))
      )
    }

    // Merge and sort by score (lower = better)
    return [...containerResults, ...itemResults].sort((a, b) => a.score - b.score)
  }

  async function searchWithOnlineMerge(
    query: string,
    activeTags: string[],
    apiBase: string
  ): Promise<SearchResult[]> {
    await ensureIndex()

    // Run local search
    const local = search(query, activeTags)

    if (!query.trim() || typeof navigator === 'undefined' || !navigator.onLine) {
      return local
    }

    // Merge with online results in background
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (activeTags.length) params.set('tags', activeTags.join(','))
      const res = await fetch(`${apiBase}/api/v1/items/search?${params}`)
      if (res.ok) {
        const onlineItems: LocalItem[] = await res.json()
        const localItemIds = new Set(
          local.filter(r => r.type === 'item').map(r => r.item!.id)
        )
        const extra: SearchResult[] = onlineItems
          .filter(i => !localItemIds.has(i.id))
          .map(item => ({
            type: 'item' as const,
            item,
            score: 0.5,
            matches: undefined,
            breadcrumb: item.containerId
              ? getBreadcrumb(item.containerId, allContainersCache)
              : []
          }))
        return [...local, ...extra]
      }
    } catch { /* offline or error — use local only */ }

    return local
  }

  async function getAllTags(): Promise<{ tag: string; count: number }[]> {
    const items = await db.getAllItems()
    const counts = new Map<string, number>()
    for (const item of items) {
      for (const tag of item.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  }

  return { buildIndex, refreshIndex, ensureIndex, search, searchWithOnlineMerge, getAllTags }
}

/** Highlight matched characters in a string using Fuse match indices */
export function highlight(
  text: string,
  matches: readonly FuseResultMatch[] | undefined,
  key: string
): string {
  if (!matches) return escapeHtml(text)
  const match = matches.find(m => m.key === key)
  if (!match?.indices?.length) return escapeHtml(text)

  let result = ''
  let last = 0
  const sorted = [...match.indices].sort((a, b) => a[0] - b[0])
  for (const [start, end] of sorted) {
    result += escapeHtml(text.slice(last, start))
    result += `<mark class="search-highlight">${escapeHtml(text.slice(start, end + 1))}</mark>`
    last = end + 1
  }
  result += escapeHtml(text.slice(last))
  return result
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
