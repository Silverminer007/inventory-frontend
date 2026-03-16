<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'theme-color', content: '#3b82f6' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'Inventory' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
    { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
    { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
  ],
  htmlAttrs: {
    lang: 'de'
  }
})

useSeoMeta({
  title: 'Lagerverwaltung',
  description: 'Inventar- und Lagerverwaltungssystem'
})

const route = useRoute()
const { showIndicator } = useSync()

const tabs = [
  { path: '/', icon: 'i-lucide-home', label: 'Raeume' },
  { path: '/search', icon: 'i-lucide-search', label: 'Suche' },
  { path: '/add', icon: 'i-lucide-plus-circle', label: 'Neu' }
]

function isActiveTab(path: string) {
  if (path === '/') return route.path === '/' || route.path.startsWith('/containers')
  return route.path.startsWith(path)
}
</script>

<template>
  <UApp>
    <div class="min-h-screen md:pl-56" :class="showIndicator ? 'pb-24 md:pb-0' : 'pb-16 md:pb-0'">
      <!-- Desktop sidebar -->
      <aside class="hidden md:flex fixed inset-y-0 left-0 z-40 w-56 flex-col border-r border-default bg-default">
        <div class="flex items-center gap-2 px-4 h-14 border-b border-default">
          <UIcon name="i-lucide-warehouse" class="text-primary text-xl" />
          <span class="font-semibold text-lg">Lagerverwaltung</span>
        </div>
        <nav class="flex-1 p-3 space-y-1">
          <NuxtLink
            v-for="tab in tabs"
            :key="tab.path"
            :to="tab.path"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            :class="isActiveTab(tab.path) ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-elevated'"
          >
            <UIcon :name="tab.icon" class="text-lg" />
            {{ tab.label }}
          </NuxtLink>
        </nav>
        <div class="p-3 border-t border-default space-y-1">
          <OfflineIndicator />
          <NuxtLink
            to="/admin/debug"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            :class="route.path.startsWith('/admin') ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-elevated'"
          >
            <UIcon name="i-lucide-bug" class="text-lg" />
            Debug
          </NuxtLink>
        </div>
      </aside>

      <!-- Main content -->
      <main class="min-h-screen">
        <NuxtPage />
      </main>

      <!-- Mobile bottom tabs -->
      <nav class="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-default bg-default safe-bottom">
        <ClientOnly>
          <OfflineIndicator class="mx-3 mt-2" />
        </ClientOnly>
        <div class="flex">
          <NuxtLink
            v-for="tab in tabs"
            :key="tab.path"
            :to="tab.path"
            class="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors"
            :class="isActiveTab(tab.path) ? 'text-primary' : 'text-muted'"
          >
            <UIcon :name="tab.icon" class="text-xl" />
            {{ tab.label }}
          </NuxtLink>
        </div>
      </nav>
    </div>
  </UApp>
</template>

<style>
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
