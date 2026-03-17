<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSync } from '~/composables/useSync'
import { useSearch } from '~/composables/useSearch'

const route = useRoute()
const sync = useSync()
const search = useSearch()

const showMigrationNotice = ref(false)

onMounted(async () => {
  if (localStorage.getItem('db-version') !== '3') {
    showMigrationNotice.value = true
    localStorage.setItem('db-version', '3')
    setTimeout(() => { showMigrationNotice.value = false }, 6000)
  }
  await sync.bootstrap().catch(console.error)
  await search.refreshIndex().catch(console.error)
})

const navItems = [
  { to: '/', icon: 'mdi:home-outline', iconActive: 'mdi:home', label: 'Übersicht' },
  { to: '/search', icon: 'mdi:magnify', iconActive: 'mdi:magnify', label: 'Suche' },
  { to: '/scan', icon: 'mdi:qrcode-scan', iconActive: 'mdi:qrcode-scan', label: 'Scannen' },
  { to: '/settings', icon: 'mdi:cog-outline', iconActive: 'mdi:cog', label: 'Einstellungen' }
]

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<template>
  <div class="flex flex-col min-h-dvh" style="background: var(--color-surface-1)">
    <!-- ─── Migration notice ────────────────────────────────────────────────── -->
    <Transition name="slide-down">
      <div
        v-if="showMigrationNotice"
        class="fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium text-white"
        style="background: var(--color-accent)"
      >
        App wurde aktualisiert — lokale Daten werden neu synchronisiert.
      </div>
    </Transition>

    <!-- ─── Header (sticky) ─────────────────────────────────────────────────── -->
    <header
      class="sticky top-0 z-20 h-14 flex items-center px-4 gap-3"
      style="
        background: var(--color-surface-0);
        border-bottom: 1px solid var(--color-border);
        padding-top: env(safe-area-inset-top, 0)
      "
    >
      <!-- Logo / App Name -->
      <NuxtLink
        to="/"
        class="flex items-center gap-2 font-bold text-base mr-auto"
        style="color: var(--color-text-primary)"
      >
        <Icon icon="mdi:package-variant-closed" class="w-6 h-6" style="color: var(--color-accent)" />
        <span class="hidden sm:inline">Lager</span>
      </NuxtLink>

      <!-- Search shortcut (only visible outside search page) -->
      <NuxtLink
        v-if="route.path !== '/search'"
        to="/search"
        class="flex items-center gap-2 flex-1 max-w-xs h-9 px-3 rounded-xl text-sm"
        style="background: var(--color-surface-2); color: var(--color-text-muted)"
        aria-label="Suche"
      >
        <Icon icon="mdi:magnify" class="w-4 h-4" />
        <span class="hidden sm:inline">Suchen…</span>
      </NuxtLink>

      <!-- Sync Status Indicator -->
      <SyncStatus />

      <!-- Settings link -->
      <NuxtLink
        to="/settings"
        class="btn btn-ghost p-2"
        aria-label="Einstellungen"
        :style="isActive('/settings') ? 'color: var(--color-accent)' : ''"
      >
        <Icon :icon="isActive('/settings') ? 'mdi:cog' : 'mdi:cog-outline'" class="w-5 h-5" />
      </NuxtLink>
    </header>

    <!-- ─── Main Content ────────────────────────────────────────────────────── -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Side Navigation (lg+) -->
      <nav
        class="hidden lg:flex flex-col w-56 shrink-0 py-4 px-3 gap-1"
        style="
          background: var(--color-surface-0);
          border-right: 1px solid var(--color-border)
        "
        aria-label="Hauptnavigation"
      >
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
          :style="isActive(item.to)
            ? 'background: var(--color-nav-active-bg); color: var(--color-nav-active-text)'
            : 'color: var(--color-text-secondary)'"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <Icon
            :icon="isActive(item.to) ? item.iconActive : item.icon"
            class="w-5 h-5"
          />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- Page Slot -->
      <main class="flex-1 overflow-y-auto" style="padding-bottom: 5rem">
        <slot />
      </main>
    </div>

    <!-- ─── Bottom Navigation (mobile only) ────────────────────────────────── -->
    <nav
      class="lg:hidden fixed bottom-0 left-0 right-0 z-20 h-16 flex items-center"
      style="
        background: var(--color-surface-0);
        border-top: 1px solid var(--color-border);
        padding-bottom: env(safe-area-inset-bottom, 0)
      "
      aria-label="Navigation"
    >
      <!-- Home -->
      <NuxtLink
        to="/"
        class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
        :style="isActive('/') ? 'color: var(--color-accent)' : 'color: var(--color-text-muted)'"
        :aria-current="isActive('/') ? 'page' : undefined"
      >
        <Icon :icon="isActive('/') ? 'mdi:home' : 'mdi:home-outline'" class="w-6 h-6" />
        <span class="text-[10px] font-medium">Übersicht</span>
      </NuxtLink>

      <!-- Search -->
      <NuxtLink
        to="/search"
        class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
        :style="isActive('/search') ? 'color: var(--color-accent)' : 'color: var(--color-text-muted)'"
        :aria-current="isActive('/search') ? 'page' : undefined"
      >
        <Icon icon="mdi:magnify" class="w-6 h-6" />
        <span class="text-[10px] font-medium">Suche</span>
      </NuxtLink>

      <!-- Scan -->
      <NuxtLink
        to="/scan"
        class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
        :style="isActive('/scan') ? 'color: var(--color-accent)' : 'color: var(--color-text-muted)'"
        :aria-current="isActive('/scan') ? 'page' : undefined"
      >
        <Icon icon="mdi:qrcode-scan" class="w-6 h-6" />
        <span class="text-[10px] font-medium">Scannen</span>
      </NuxtLink>

      <!-- Settings -->
      <NuxtLink
        to="/settings"
        class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
        :style="isActive('/settings') ? 'color: var(--color-accent)' : 'color: var(--color-text-muted)'"
        :aria-current="isActive('/settings') ? 'page' : undefined"
      >
        <Icon :icon="isActive('/settings') ? 'mdi:cog' : 'mdi:cog-outline'" class="w-6 h-6" />
        <span class="text-[10px] font-medium">Einstellungen</span>
      </NuxtLink>
    </nav>

    <!-- PWA Install Banner -->
    <PwaInstallBanner />
  </div>
</template>
