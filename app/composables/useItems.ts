import type { ItemDTO, MoveItemRequest } from '~/types'

export function useItems() {
  const { apiFetch } = useApi()
  const base = '/api/v1/items'

  function getAll() {
    return useAsyncData('items-all', () =>
      apiFetch<ItemDTO[]>(base)
    )
  }

  function getById(id: number | string) {
    return useAsyncData(`item-${id}`, () =>
      apiFetch<ItemDTO>(`${base}/${id}`)
    )
  }

  async function search(query: string, tags?: string[]): Promise<ItemDTO[]> {
    return await apiFetch<ItemDTO[]>(`${base}/search`, {
      params: { q: query || undefined, tags: tags?.length ? tags : undefined }
    })
  }

  async function getByTag(tag: string): Promise<ItemDTO[]> {
    return await apiFetch<ItemDTO[]>(`${base}/by-tag/${encodeURIComponent(tag)}`)
  }

  async function suggestTags(itemName: string): Promise<string[]> {
    const response = await apiFetch<string[]>(`${base}/tags/suggest`, {
      params: { item: itemName }
    })
    console.log(response[0])
    return response
  }

  async function searchTags(query?: string): Promise<string[]> {
    const params: Record<string, string> = {}
    if (query?.trim()) params.q = query
    return await apiFetch<string[]>(`${base}/tags`, { params })
  }

  async function create(item: ItemDTO) {
    return await apiFetch<ItemDTO>(base, {
      method: 'POST',
      body: item
    })
  }

  async function update(id: number, item: ItemDTO) {
    return await apiFetch<ItemDTO>(`${base}/${id}`, {
      method: 'PUT',
      body: item
    })
  }

  async function remove(id: number) {
    return await apiFetch<void>(`${base}/${id}`, {
      method: 'DELETE'
    })
  }

  async function move(id: number, request: MoveItemRequest) {
    return await apiFetch<ItemDTO>(`${base}/${id}/move`, {
      method: 'POST',
      body: request
    })
  }

  return { getAll, getById, search, getByTag, searchTags, suggestTags, create, update, remove, move }
}
