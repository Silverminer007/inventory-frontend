import type { ContainerDTO, MoveContainerRequest } from '~/types'

export function useContainers() {
  const { apiFetch } = useApi()
  const base = '/api/v1/containers'

  function getRoots() {
    return useAsyncData('container-roots', () =>
      apiFetch<ContainerDTO[]>(`${base}/roots`),
      { watch: [] }
    )
  }

  function getAll(type?: string) {
    const query = type ? `?type=${type}` : ''
    return useAsyncData(`containers-${type || 'all'}`, () =>
      apiFetch<ContainerDTO[]>(`${base}${query}`),
      { watch: [] }
    )
  }

  function getById(id: Ref<string> | string) {
    const idRef = toRef(id)
    return useAsyncData(`container-${idRef.value}`, () =>
      apiFetch<ContainerDTO>(`${base}/${idRef.value}`),
      { watch: [idRef] }
    )
  }

  function getChildren(id: Ref<string> | string) {
    const idRef = toRef(id)
    return useAsyncData(`container-${idRef.value}-children`, () =>
      apiFetch<ContainerDTO[]>(`${base}/${idRef.value}/children`),
      { watch: [idRef] }
    )
  }

  async function create(container: ContainerDTO) {
    return await apiFetch<ContainerDTO>(base, {
      method: 'POST',
      body: container
    })
  }

  async function update(id: number, container: ContainerDTO) {
    return await apiFetch<ContainerDTO>(`${base}/${id}`, {
      method: 'PUT',
      body: container
    })
  }

  async function remove(id: number) {
    return await apiFetch<void>(`${base}/${id}`, {
      method: 'DELETE'
    })
  }

  async function move(id: number, request: MoveContainerRequest) {
    return await apiFetch<ContainerDTO>(`${base}/${id}/move`, {
      method: 'POST',
      body: request
    })
  }

  async function fetchAllFlat(type?: string): Promise<ContainerDTO[]> {
    const query = type ? `?type=${type}` : ''
    return await apiFetch<ContainerDTO[]>(`${base}${query}`)
  }

  return { getRoots, getAll, getById, getChildren, create, update, remove, move, fetchAllFlat }
}
