export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const path = getRouterParam(event, 'path') || ''
  const query = getQuery(event)
  const queryString = new URLSearchParams(query as Record<string, string>).toString()
  const target = `${config.apiBase}/api/v1/${path}${queryString ? `?${queryString}` : ''}`
  return proxyRequest(event, target)
})
