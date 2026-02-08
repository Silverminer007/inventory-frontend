export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const path = getRouterParam(event, 'path') || ''
  const target = `${config.apiBase}/api/v1/${path}`
  return proxyRequest(event, target)
})
