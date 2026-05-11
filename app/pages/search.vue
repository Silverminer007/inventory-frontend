<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { useSearch, highlight, type SearchResult } from '~/composables/useSearch'
  import { useDatabase } from '~/composables/useDatabase'
  import { containerConfig } from '~/utils/containerUtils'
  import type { Category } from '~/types/inventory'

  const route = useRoute()

  const search = useSearch()
  const db = useDatabase()

  const query = ref((route.query.q as string) ?? '')
  const activeTags = ref<string[]>([])
  const activeCategoryIds = ref<string[]>([])
  const allCategories = ref<Category[]>([])
  const isSearching = ref(false)
  const error = ref<string | null>(null)
  const results = ref<SearchResult[]>([])
  const showTagFilter = ref(false)
  const showCategoryFilter = ref(false)

  const activeCategories = computed(() =>
    allCategories.value.filter((c) => activeCategoryIds.value.includes(c.id)),
  )

  // ─── Debounced search ──────────────────────────────────────────────────────────
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  watch(
    [query, activeTags, activeCategoryIds],
    () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      const q = query.value.trim()
      if (q.length < 2 && activeTags.value.length === 0 && activeCategoryIds.value.length === 0) {
        results.value = []
        return
      }
      debounceTimer = setTimeout(() => performSearch(), 250)
    },
    { deep: true },
  )

  async function performSearch() {
    isSearching.value = true
    error.value = null
    try {
      results.value = await search.searchWithEnsuredIndex(
        query.value.trim(),
        activeTags.value,
        activeCategoryIds.value,
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Suchfehler'
    } finally {
      isSearching.value = false
    }
  }

  // ─── Grouped results ───────────────────────────────────────────────────────────
  const containerResults = computed(() => results.value.filter((r) => r.type === 'container'))
  const itemResults = computed(() => results.value.filter((r) => r.type === 'item'))

  const rooms = computed(() =>
    containerResults.value.filter((r) => r.container?.containerType === 'ROOM'),
  )
  const shelves = computed(() =>
    containerResults.value.filter((r) => r.container?.containerType === 'SHELF'),
  )
  const boxes = computed(() =>
    containerResults.value.filter((r) => r.container?.containerType === 'BOX'),
  )

  const hasResults = computed(() => results.value.length > 0)
  const showEmpty = computed(
    () =>
      !isSearching.value &&
      !hasResults.value &&
      (query.value.trim().length >= 2 ||
        activeTags.value.length > 0 ||
        activeCategoryIds.value.length > 0),
  )
  const emptyTitle = computed(() => {
    if (!query.value.trim()) {
      if (activeTags.value.length > 0 || activeCategoryIds.value.length > 0) {
        return 'Keine Items mit diesen Filtern'
      }
    }
    return `Keine Treffer für '${query.value}'`
  })

  // ─── Input ref ────────────────────────────────────────────────────────────────
  const inputEl = ref<HTMLInputElement | null>(null)

  onMounted(async () => {
    await Promise.all([
      search.ensureIndex(),
      db.getAllCategories().then((c) => (allCategories.value = c)),
    ])
    if (query.value.trim().length >= 2) {
      performSearch()
    } else {
      inputEl.value?.focus()
    }
  })
</script>

<template>
  <div class="flex flex-col min-h-full">
    <!-- ─── Search Field ──────────────────────────────────────────────────── -->
    <div class="px-4 pt-4 pb-3 sticky top-0 z-10" style="background: var(--color-surface-1)">
      <div class="relative">
        <Icon
          icon="mdi:magnify"
          class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
          style="color: var(--color-text-muted)"
        />
        <input
          ref="inputEl"
          v-model="query"
          type="text"
          placeholder="Items, Räume, Regale suchen…"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          class="search-input"
          data-testid="search-input"
        />
        <button
          v-if="query"
          class="absolute right-3 top-1/2 -translate-y-1/2"
          aria-label="Löschen"
          @click="query = ''"
        >
          <Icon icon="mdi:close-circle" class="w-4 h-4" style="color: var(--color-text-muted)" />
        </button>
      </div>

      <!-- Filter + result count row -->
      <div class="flex items-center gap-2 mt-2">
        <!-- Tag filter button -->
        <button
          class="relative flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full shrink-0 transition-colors"
          :style="
            activeTags.length > 0
              ? 'background: var(--color-nav-active-bg); color: var(--color-nav-active-text)'
              : 'background: var(--color-surface-2); color: var(--color-text-secondary)'
          "
          data-testid="filter-button"
          @click="showTagFilter = true"
        >
          <Icon icon="mdi:tag-multiple-outline" class="w-4 h-4" />
          Tags
          <span
            v-if="activeTags.length > 0"
            class="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
            style="background: var(--color-accent); color: #fff"
          >
            {{ activeTags.length }}
          </span>
        </button>

        <!-- Category filter button -->
        <button
          class="relative flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full shrink-0 transition-colors"
          :style="
            activeCategoryIds.length > 0
              ? 'background: var(--color-nav-active-bg); color: var(--color-nav-active-text)'
              : 'background: var(--color-surface-2); color: var(--color-text-secondary)'
          "
          data-testid="category-filter-button"
          @click="showCategoryFilter = true"
        >
          <Icon icon="mdi:shape-outline" class="w-4 h-4" />
          Kategorie
          <span
            v-if="activeCategoryIds.length > 0"
            class="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
            style="background: var(--color-accent); color: #fff"
          >
            {{ activeCategoryIds.length }}
          </span>
        </button>

        <!-- Active chips (tags + categories) -->
        <div class="flex gap-1.5 overflow-x-auto pb-0.5 flex-1">
          <button
            v-for="tag in activeTags"
            :key="tag"
            class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
            style="background: var(--color-nav-active-bg); color: var(--color-nav-active-text)"
            @click="activeTags = activeTags.filter((t) => t !== tag)"
          >
            {{ tag }}
            <Icon icon="mdi:close" class="w-2.5 h-2.5" />
          </button>
          <button
            v-for="cat in activeCategories"
            :key="cat.id"
            class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
            style="background: var(--color-nav-active-bg); color: var(--color-nav-active-text)"
            @click="activeCategoryIds = activeCategoryIds.filter((id) => id !== cat.id)"
          >
            <span class="font-mono font-bold uppercase" style="color: var(--color-accent)">{{
              cat.shortCode
            }}</span>
            {{ cat.name }}
            <Icon icon="mdi:close" class="w-2.5 h-2.5" />
          </button>
        </div>

        <!-- Result count -->
        <span v-if="hasResults" class="text-xs shrink-0" style="color: var(--color-text-muted)">
          {{ results.length }} Treffer
        </span>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="px-4 pb-2">
      <ErrorBanner :message="error" @dismiss="error = null" />
    </div>

    <!-- Loading -->
    <div v-if="isSearching" class="flex justify-center py-8">
      <LoadingSpinner />
    </div>

    <!-- Empty query state -->
    <EmptyState
      v-else-if="query.length < 2 && activeTags.length === 0 && activeCategoryIds.length === 0"
      icon="mdi:magnify"
      title="Wonach suchst du?"
      description="Mindestens 2 Zeichen eingeben oder Filter wählen"
      data-testid="empty-state"
    />

    <!-- No results -->
    <EmptyState
      v-else-if="showEmpty"
      icon="mdi:text-search"
      :title="emptyTitle"
      :description="
        activeTags.length > 0 || activeCategoryIds.length > 0
          ? 'Versuche andere Filter oder eine breitere Suche'
          : ''
      "
      data-testid="empty-state"
    />

    <!-- ─── Results ───────────────────────────────────────────────────────── -->
    <div v-else class="px-4 pb-8 space-y-5">
      <!-- Räume -->
      <section v-if="rooms.length > 0">
        <div class="flex items-center gap-2 mb-2">
          <Icon
            :icon="containerConfig.ROOM.icon"
            class="w-4 h-4"
            style="color: var(--color-text-muted)"
          />
          <span
            class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--color-text-muted)"
          >
            Räume ({{ rooms.length }})
          </span>
        </div>
        <div class="space-y-2">
          <NuxtLink
            v-for="r in rooms"
            :key="r.container!.id"
            :to="`/containers/${r.container!.id}`"
            class="card flex items-center gap-3 active:opacity-70 transition-opacity"
          >
            <Icon
              :icon="containerConfig.ROOM.icon"
              class="w-5 h-5 shrink-0"
              style="color: var(--color-accent)"
            />
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span
              class="font-medium truncate"
              style="color: var(--color-text-primary)"
              v-html="highlight(r.container!.name, r.matches, 'name')"
            />
            <Icon
              icon="mdi:chevron-right"
              class="w-4 h-4 ml-auto shrink-0"
              style="color: var(--color-text-muted)"
            />
          </NuxtLink>
        </div>
      </section>

      <!-- Regale -->
      <section v-if="shelves.length > 0">
        <div class="flex items-center gap-2 mb-2">
          <Icon
            :icon="containerConfig.SHELF.icon"
            class="w-4 h-4"
            style="color: var(--color-text-muted)"
          />
          <span
            class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--color-text-muted)"
          >
            Regale ({{ shelves.length }})
          </span>
        </div>
        <div class="space-y-2">
          <NuxtLink
            v-for="r in shelves"
            :key="r.container!.id"
            :to="`/containers/${r.container!.id}`"
            class="card flex items-center gap-3 active:opacity-70 transition-opacity"
          >
            <Icon
              :icon="containerConfig.SHELF.icon"
              class="w-5 h-5 shrink-0"
              style="color: var(--color-accent)"
            />
            <div class="flex-1 min-w-0">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <p
                class="font-medium truncate"
                style="color: var(--color-text-primary)"
                v-html="highlight(r.container!.name, r.matches, 'name')"
              />
              <p
                v-if="r.breadcrumb.length"
                class="text-xs truncate"
                style="color: var(--color-text-muted)"
              >
                {{ r.breadcrumb.map((c) => c.name).join(' → ') }}
              </p>
            </div>
            <Icon
              icon="mdi:chevron-right"
              class="w-4 h-4 shrink-0"
              style="color: var(--color-text-muted)"
            />
          </NuxtLink>
        </div>
      </section>

      <!-- Kisten -->
      <section v-if="boxes.length > 0">
        <div class="flex items-center gap-2 mb-2">
          <Icon
            :icon="containerConfig.BOX.icon"
            class="w-4 h-4"
            style="color: var(--color-text-muted)"
          />
          <span
            class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--color-text-muted)"
          >
            Kisten ({{ boxes.length }})
          </span>
        </div>
        <div class="space-y-2">
          <NuxtLink
            v-for="r in boxes"
            :key="r.container!.id"
            :to="`/containers/${r.container!.id}`"
            class="card flex items-center gap-3 active:opacity-70 transition-opacity"
          >
            <Icon
              :icon="containerConfig.BOX.icon"
              class="w-5 h-5 shrink-0"
              style="color: var(--color-accent)"
            />
            <div class="flex-1 min-w-0">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <p
                class="font-medium truncate"
                style="color: var(--color-text-primary)"
                v-html="highlight(r.container!.name, r.matches, 'name')"
              />
              <p
                v-if="r.breadcrumb.length"
                class="text-xs truncate"
                style="color: var(--color-text-muted)"
              >
                {{ r.breadcrumb.map((c) => c.name).join(' → ') }}
              </p>
            </div>
            <Icon
              icon="mdi:chevron-right"
              class="w-4 h-4 shrink-0"
              style="color: var(--color-text-muted)"
            />
          </NuxtLink>
        </div>
      </section>

      <!-- Items -->
      <section v-if="itemResults.length > 0">
        <div class="flex items-center gap-2 mb-2">
          <Icon icon="mdi:cube-outline" class="w-4 h-4" style="color: var(--color-text-muted)" />
          <span
            class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--color-text-muted)"
          >
            Items ({{ itemResults.length }})
          </span>
        </div>
        <div class="space-y-2">
          <NuxtLink
            v-for="r in itemResults"
            :key="r.item!.id"
            :to="`/items/${r.item!.id}`"
            class="card flex items-center gap-3 active:opacity-70 transition-opacity"
          >
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style="background: var(--color-surface-2)"
            >
              <Icon
                icon="mdi:cube-outline"
                class="w-5 h-5"
                style="color: var(--color-text-muted)"
              />
            </div>
            <div class="flex-1 min-w-0">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <p
                class="font-medium truncate"
                style="color: var(--color-text-primary)"
                v-html="highlight(r.item!.name, r.matches, 'name')"
              />
              <p
                v-if="r.breadcrumb.length"
                class="text-xs truncate"
                style="color: var(--color-text-muted)"
              >
                {{ r.breadcrumb.map((c) => c.name).join(' → ') }}
              </p>
              <div v-if="r.item!.tags?.length" class="flex flex-wrap gap-1 mt-1">
                <Badge v-for="tag in r.item!.tags!.slice(0, 3)" :key="tag" variant="default">
                  {{ tag }}
                </Badge>
                <span
                  v-if="r.item!.tags!.length > 3"
                  class="text-xs"
                  style="color: var(--color-text-muted)"
                >
                  +{{ r.item!.tags!.length - 3 }}
                </span>
              </div>
            </div>
            <Icon
              icon="mdi:chevron-right"
              class="w-4 h-4 shrink-0"
              style="color: var(--color-text-muted)"
            />
          </NuxtLink>
        </div>
      </section>
    </div>

    <!-- ─── Tag Filter Sheet ──────────────────────────────────────────────── -->
    <BottomSheet v-if="showTagFilter" title="Tag-Filter" @close="showTagFilter = false">
      <div class="space-y-4">
        <TagFilter v-model="activeTags" />
        <button class="btn btn-primary w-full" @click="showTagFilter = false">
          Filter anwenden
        </button>
      </div>
    </BottomSheet>

    <!-- ─── Category Filter Sheet ─────────────────────────────────────────── -->
    <BottomSheet
      v-if="showCategoryFilter"
      title="Kategorie-Filter"
      @close="showCategoryFilter = false"
    >
      <div class="space-y-4">
        <CategoryFilter v-model="activeCategoryIds" />
        <button class="btn btn-primary w-full" @click="showCategoryFilter = false">
          Filter anwenden
        </button>
      </div>
    </BottomSheet>
  </div>
</template>

<style>
  .search-highlight {
    background: var(--color-nav-active-bg);
    color: var(--color-nav-active-text);
    border-radius: 2px;
    padding: 0 2px;
  }
</style>
