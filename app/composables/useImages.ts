import type { Image } from '~/types/inventory'
import { useDatabase } from '~/composables/useDatabase'

export function useImages() {
  const db = useDatabase()
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string

  async function loadImagesForItem(itemId: string): Promise<Image[]> {
    const cached = await db.getImagesForItem(itemId)
    if (cached.length > 0) return cached

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const res = await fetch(`${apiBase}/api/v1/items/${itemId}/images`)
        if (res.ok) {
          const images: Image[] = await res.json()
          for (const img of images) await db.upsertImage(img)
          return images
        }
      } catch {
        /* offline */
      }
    }
    return []
  }

  async function loadImagesForContainer(containerId: string): Promise<Image[]> {
    const cached = await db.getImagesForContainer(containerId)
    if (cached.length > 0) return cached

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const res = await fetch(`${apiBase}/api/v1/containers/${containerId}/images`)
        if (res.ok) {
          const images: Image[] = await res.json()
          for (const img of images) await db.upsertImage(img)
          return images
        }
      } catch {
        /* offline */
      }
    }
    return []
  }

  async function refreshImagesForItem(itemId: string): Promise<Image[]> {
    const cached = await db.getImagesForItem(itemId)
    for (const img of cached) await db.deleteImage(img.id)
    return loadImagesForItem(itemId)
  }

  async function refreshImagesForContainer(containerId: string): Promise<Image[]> {
    const cached = await db.getImagesForContainer(containerId)
    for (const img of cached) await db.deleteImage(img.id)
    return loadImagesForContainer(containerId)
  }

  return {
    loadImagesForItem,
    loadImagesForContainer,
    refreshImagesForItem,
    refreshImagesForContainer,
  }
}
