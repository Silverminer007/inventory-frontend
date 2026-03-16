<script setup lang="ts">
import type { ItemDTO } from '~/types'

const { search, searchTags } = useItems()

const query = ref('')
const selectedTags = ref<string[]>([])
const results = ref<ItemDTO[]>([])
const loading = ref(false)
const searched = ref(false)

// Tag picker state
const tagQuery = ref('')
const tagSuggestions = ref<string[]>([])
const tagLoading = ref(false)
const allTagsCache = ref<string[] | null>(null)

// --- Search logic ---

let debounceTimer: ReturnType<typeof setTimeout>

watch([query, selectedTags], () => {
  clearTimeout(debounceTimer)
  const q = query.value.trim()
  const tags = selectedTags.value

  if (!q && !tags.length) {
    results.value = []
    searched.value = false
    return
  }

  debounceTimer = setTimeout(async () => {
    loading.value = true
    searched.value = true
    try {
      results.value = await search(q, tags)
    } finally {
      loading.value = false
    }
  }, 300)
}, { deep: true })

// --- Tag picker logic ---

let tagDebounceTimer: ReturnType<typeof setTimeout>

watch(tagQuery, (val) => {
  clearTimeout(tagDebounceTimer)
  if (!val?.trim() && allTagsCache.value) {
    tagSuggestions.value = allTagsCache.value
    return
  }
  tagDebounceTimer = setTimeout(async () => {
    tagLoading.value = true
    try {
      tagSuggestions.value = await searchTags(val || undefined)
      if (!val?.trim()) {
        allTagsCache.value = tagSuggestions.value
      }
    } finally {
      tagLoading.value = false
    }
  }, 200)
})

async function loadAllTags() {
  if (allTagsCache.value) {
    tagSuggestions.value = allTagsCache.value
    return
  }
  tagLoading.value = true
  try {
    allTagsCache.value = await searchTags()
    tagSuggestions.value = allTagsCache.value
  } finally {
    tagLoading.value = false
  }
}

const filteredTagSuggestions = computed(() =>
  tagSuggestions.value.filter(t => !selectedTags.value.includes(t))
)

// --- Tag actions ---

function onTagSelect(tag: string) {
  if (tag && !selectedTags.value.includes(tag)) {
    selectedTags.value.push(tag)
    tagQuery.value = ''
  }
}

function toggleTag(tag: string) {
  const idx = selectedTags.value.indexOf(tag)
  if (idx >= 0) {
    selectedTags.value.splice(idx, 1)
  } else {
    selectedTags.value.push(tag)
  }
}

function removeTag(tag: string) {
  const idx = selectedTags.value.indexOf(tag)
  if (idx >= 0) {
    selectedTags.value.splice(idx, 1)
  }
}
</script>

<template>
  <div class="p-4 max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold mb-4">Suche</h1>

    <!-- Text search -->
    <UInput
      v-model="query"
      placeholder="Gegenstand suchen..."
      icon="i-lucide-search"
      size="lg"
      autofocus
      class="mb-3 pr-3"
    />

    <!-- Tag picker -->
    <UInputMenu
      :model-value="undefined"
      v-model:search-term="tagQuery"
      :items="filteredTagSuggestions"
      ignore-filter
      placeholder="Tag suchen..."
      icon="i-lucide-tag"
      :loading="tagLoading"
      open-on-focus
      reset-search-term-on-select
      class="mb-3"
      @update:model-value="onTagSelect"
      size="lg"
      @focus="loadAllTags"
    >
      <template #empty>
        <span class="text-sm text-muted p-2">Keine Tags gefunden</span>
      </template>
    </UInputMenu>

    <!-- Selected tags -->
    <div v-if="selectedTags.length" class="flex flex-wrap gap-2 mb-4">
      <UBadge
        v-for="tag in selectedTags"
        :key="tag"
        :label="tag"
        color="primary"
        variant="solid"
        size="sm"
        class="cursor-pointer"
        @click="removeTag(tag)"
      >
        <template #trailing>
          <UIcon name="i-lucide-x" class="text-xs" />
        </template>
      </UBadge>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <USkeleton v-for="i in 3" :key="i" class="h-20 rounded-xl" />
    </div>

    <!-- Results -->
    <div v-else-if="results.length" class="space-y-2">
      <p class="text-sm text-muted mb-3">{{ results.length }} Ergebnis{{ results.length !== 1 ? 'se' : '' }}</p>
      <NuxtLink
        v-for="item in results"
        :key="item.id"
        :to="`/items/${item.id}`"
        class="block p-3 rounded-xl border border-default bg-default hover:bg-elevated transition-colors shadow-sm"
      >
        <div class="flex items-start gap-3">
          <div class="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/30 shrink-0 mt-0.5">
            <UIcon name="i-lucide-package" class="text-amber-600 text-lg" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium">{{ item.name }}</p>
            <p v-if="item.description" class="text-xs text-muted truncate">{{ item.description }}</p>

            <!-- Location path -->
            <span
              v-if="!!item.container || !!item.locationPath"
              class="inline-flex items-center gap-1 text-xs text-muted mt-1"
            >
              {{ item.locationPath || item.container.path || item.container.name }}
            </span>

            <!-- Tags -->
            <div v-if="item.tags?.length" class="flex flex-wrap gap-1 mt-1.5">
              <UBadge
                v-for="tag in item.tags"
                :key="tag"
                :label="tag"
                color="primary"
                :variant="selectedTags.includes(tag) ? 'solid' : 'subtle'"
                size="xs"
                class="cursor-pointer"
                @click.prevent.stop="toggleTag(tag)"
              />
            </div>
          </div>
          <UBadge v-if="item.quantity > 1" :label="`${item.quantity}x`" color="neutral" variant="subtle" size="sm" />
        </div>
      </NuxtLink>
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
