import type { ImageDTO } from '~/types'

export function useImages() {
  async function getImages(entityType: 'items' | 'containers', entityId: number): Promise<ImageDTO[]> {
    const images = await $fetch<ImageDTO[]>(`/api/v1/images/${entityType}/${entityId}`)

    // Proactively warm the image cache for offline use (fire-and-forget)
    if (images.length > 0 && typeof caches !== 'undefined') {
      caches.open('image-cache').then(cache =>
        Promise.allSettled(images.map(img => cache.add(img.url)))
      ).catch(() => {})
    }

    return images
  }

  async function uploadImage(entityType: 'items' | 'containers', entityId: number, file: File, isPrimary: boolean = false): Promise<ImageDTO> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('isPrimary', String(isPrimary))

    return await $fetch<ImageDTO>(`/api/v1/images/${entityType}/${entityId}`, {
      method: 'POST',
      body: formData
    })
  }

  async function deleteImage(imageId: number): Promise<void> {
    await $fetch(`/api/v1/images/${imageId}`, {
      method: 'DELETE'
    })
  }

  async function getImageMetadata(imageId: number): Promise<ImageDTO> {
    return await $fetch<ImageDTO>(`/api/v1/images/${imageId}`)
  }

  return { getImages, uploadImage, deleteImage, getImageMetadata }
}
