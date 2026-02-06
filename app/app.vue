<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
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
    <div class="min-h-screen pb-16 md:pb-0 md:pl-56">
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
      </aside>

      <!-- Main content -->
      <main class="min-h-screen">
        <NuxtPage />
      </main>

      <!-- Mobile bottom tabs -->
      <nav class="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-default bg-default safe-bottom">
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
