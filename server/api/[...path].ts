import { $fetch } from 'ofetch'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const path = event.context.params?.path || ''
  const query = getQuery(event)
  const apiUrl = `${config.apiBase}/api/${path}`

  let body
  if (['POST', 'PUT', 'PATCH'].includes(event.method)) {
    body = await readBody(event)
  }

  return await $fetch(apiUrl, {
    method: event.method,
    query,
    body,
  })
})
