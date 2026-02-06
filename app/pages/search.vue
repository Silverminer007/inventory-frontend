<script setup lang="ts">
import type { ItemDTO } from '~/types'

const { search, getByTag } = useItems()

const query = ref('')
const activeTag = ref<string | null>(null)
const results = ref<ItemDTO[]>([])
const loading = ref(false)
const searched = ref(false)

let debounceTimer: ReturnType<typeof setTimeout>

watch(query, (val) => {
  activeTag.value = null
  clearTimeout(debounceTimer)
  if (!val.trim()) {
    results.value = []
    searched.value = false
    return
  }
  debounceTimer = setTimeout(async () => {
    loading.value = true
    searched.value = true
    try {
      results.value = await search(val)
    } finally {
      loading.value = false
    }
  }, 300)
})

async function searchByTag(tag: string) {
  if (activeTag.value === tag) {
    activeTag.value = null
    results.value = []
    searched.value = false
    return
  }
  activeTag.value = tag
  query.value = ''
  loading.value = true
  searched.value = true
  try {
    results.value = await getByTag(tag)
  } finally {
    loading.value = false
  }
}

const allTags = computed(() => {
  const tags = new Set<string>()
  results.value.forEach(item => item.tags?.forEach(t => tags.add(t)))
  return Array.from(tags).sort()
})

function containerIcon(type?: string) {
  switch (type) {
    case 'ROOM': return 'i-lucide-door-open'
    case 'SHELF': return 'i-lucide-rows-3'
    case 'BOX': return 'i-lucide-box'
    default: return 'i-lucide-folder'
  }
}
</script>

<template>
  <div class="p-4 max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold mb-4">Suche</h1>

    <UInput
      v-model="query"
      placeholder="Gegenstand suchen..."
      icon="i-lucide-search"
      size="lg"
      autofocus
      class="mb-4"
    />

    <!-- Tag pills -->
    <div v-if="allTags.length" class="flex flex-wrap gap-2 mb-4">
      <UBadge
        v-for="tag in allTags"
        :key="tag"
        :label="tag"
        :color="activeTag === tag ? 'primary' : 'neutral'"
        :variant="activeTag === tag ? 'solid' : 'subtle'"
        size="sm"
        class="cursor-pointer"
        @click="searchByTag(tag)"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <USkeleton v-for="i in 3" :key="i" class="h-20 rounded-xl" />
    </div>

    <!-- Results -->
    <div v-else-if="results.length" class="space-y-2">
      <p class="text-sm text-muted mb-3">{{ results.length }} Ergebnis{{ results.length !== 1 ? 'se' : '' }}</p>
      <div
        v-for="item in results"
        :key="item.id"
        class="p-3 rounded-xl border border-default bg-default shadow-sm"
      >
        <div class="flex items-start gap-3">
          <div class="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/30 shrink-0 mt-0.5">
            <UIcon name="i-lucide-package" class="text-amber-600 text-lg" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium">{{ item.name }}</p>
            <p v-if="item.description" class="text-xs text-muted truncate">{{ item.description }}</p>

            <!-- Location path -->
            <NuxtLink
              v-if="item.container"
              :to="`/containers/${item.container.id}`"
              class="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
            >
              <UIcon :name="containerIcon(item.container.type)" class="text-sm" />
              {{ item.locationPath || item.container.path || item.container.name }}
            </NuxtLink>

            <!-- Tags -->
            <div v-if="item.tags?.length" class="flex flex-wrap gap-1 mt-1.5">
              <UBadge
                v-for="tag in item.tags"
                :key="tag"
                :label="tag"
                color="primary"
                variant="subtle"
                size="xs"
                class="cursor-pointer"
                @click="searchByTag(tag)"
              />
            </div>
          </div>
          <UBadge v-if="item.quantity > 1" :label="`${item.quantity}x`" color="neutral" variant="subtle" size="sm" />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="searched && !loading" class="text-center py-16">
      <UIcon name="i-lucide-search-x" class="text-5xl text-muted mb-3" />
      <p class="text-muted text-lg">Keine Ergebnisse</p>
      <p class="text-sm text-muted mt-1">Versuche einen anderen Suchbegriff</p>
    </div>

    <!-- Initial state -->
    <div v-else class="text-center py-16">
      <UIcon name="i-lucide-search" class="text-5xl text-muted mb-3" />
      <p class="text-muted">Suche nach Gegenstaenden per Name oder Tag</p>
    </div>
  </div>
</template>
