<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { containerConfig } from '~/utils/containerUtils'
  import { useCategoryHarmonizer, type SearchResult } from '~/composables/useCategoryHarmonizer'

  const categoryHarmonizer = await useCategoryHarmonizer()

  const error = ref<string | null>(null)
  const results = ref<SearchResult[]>([])

  // ─── Grouped results ───────────────────────────────────────────────────────────

  const rooms = computed(() => results.value.filter((r) => r.container?.containerType === 'ROOM'))
  const shelves = computed(() =>
    results.value.filter((r) => r.container?.containerType === 'SHELF'),
  )
  const boxes = computed(() => results.value.filter((r) => r.container?.containerType === 'BOX'))

  const hasResults = computed(() => results.value.length > 0)
  const showEmpty = computed(() => !hasResults.value)
  const emptyTitle = 'Keine Unsortierten Kisten'

  onMounted(() => {
    results.value = categoryHarmonizer.search()
  })
</script>

<template>
  <div class="flex flex-col min-h-full">
    <!-- Error -->
    <div v-if="error" class="px-4 pb-2">
      <ErrorBanner :message="error" @dismiss="error = null" />
    </div>

    <!-- Loading -->
    <div v-if="isSearching" class="flex justify-center py-8">
      <LoadingSpinner />
    </div>

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
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate" style="color: var(--color-text-primary)" />
              <Badge v-if="r.container!.primaryCategory" variant="purple" class="mt-1">
                {{ r.container!.primaryCategory.name }}
              </Badge>
            </div>
            <Icon
              icon="mdi:chevron-right"
              class="w-4 h-4 shrink-0"
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
              <p class="font-medium truncate" style="color: var(--color-text-primary)" />
              <p
                v-if="r.breadcrumb.length"
                class="text-xs truncate"
                style="color: var(--color-text-muted)"
              >
                {{ r.breadcrumb.map((c) => c.name).join(' → ') }}
              </p>
              <Badge v-if="r.container!.primaryCategory" variant="purple" class="mt-1">
                {{ r.container!.primaryCategory.name }}
              </Badge>
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
              <p class="font-medium truncate" style="color: var(--color-text-primary)" />
              <p
                v-if="r.breadcrumb.length"
                class="text-xs truncate"
                style="color: var(--color-text-muted)"
              >
                {{ r.breadcrumb.map((c) => c.name).join(' → ') }}
              </p>
              <Badge v-if="r.container!.primaryCategory" variant="purple" class="mt-1">
                {{ r.container!.primaryCategory.name }}
              </Badge>
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
  </div>
</template>
