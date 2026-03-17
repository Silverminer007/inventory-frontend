<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useDatabase } from '~/composables/useDatabase'

const router = useRouter()
const db = useDatabase()

async function handleScanned(value: string) {
  // 1. Try to parse as an internal app URL (from our QR codes)
  try {
    const url = new URL(value)
    const path = url.pathname

    const itemMatch = path.match(/^\/items\/(\d+)$/)
    if (itemMatch) { router.push(`/items/${itemMatch[1]}`); return }

    const containerMatch = path.match(/^\/containers\/(\d+)$/)
    if (containerMatch) { router.push(`/containers/${containerMatch[1]}`); return }
  } catch { /* not a URL */ }

  // 2. Try as barcode — look up item in local DB
  const items = await db.getAllItems()
  const match = items.find(i => i.barcode === value)
  if (match) {
    router.push(`/items/${match.id}`)
    return
  }

  // 3. Fall back to search page with the scanned value as query
  router.push(`/search?q=${encodeURIComponent(value)}`)
}
</script>

<template>
  <BarcodeScanner
    @detected="handleScanned"
    @close="router.back()"
  />
</template>
