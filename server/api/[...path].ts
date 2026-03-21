export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const path = event.context.params?.path || ''
  const query = getQuery(event)
  const queryString = new URLSearchParams(query as Record<string, string>).toString()
  const apiUrl = `${config.apiBase}/api/${path}${queryString ? `?${queryString}` : ''}`

  delete event.node.req.headers['origin']
  delete event.node.req.headers['referer']

  return proxyRequest(event, apiUrl)
})
