<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { containerConfig } from '~/utils/containerUtils'
  import { useMixedCategories, type CategoryConflict } from '~/composables/useMixedCategories'

  const mixedCategories = await useMixedCategories()

  const error = ref<string | null>(null)
  const conflicts = ref<CategoryConflict[]>([])

  // ─── Grouped results ───────────────────────────────────────────────────────────
  const shelves = computed(() =>
    conflicts.value.filter((r) => r.container?.containerType === 'SHELF'),
  )
  const boxes = computed(() => conflicts.value.filter((r) => r.container?.containerType === 'BOX'))

  const hasResults = computed(() => conflicts.value.length > 0)
  const showEmpty = computed(() => !hasResults.value)
  const emptyTitle = 'Keine Unsortierten Kisten'

  onMounted(async () => {
    conflicts.value = await mixedCategories.findConflicts()
  })
</script>

<template>
  <div class="flex flex-col max-w-2xl mx-auto min-h-full px-4 py-6">
    <!-- Page header -->
    <div class="flex items-center gap-3 mb-6">
      <h1 class="text-xl font-bold" style="color: var(--color-text-primary)">
        Unsortierte Kisten und Regale
      </h1>
    </div>
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
      data-testid="empty-state"
    />

    <!-- ─── Results ───────────────────────────────────────────────────────── -->
    <div v-else class="space-y-5">
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
              <p class="font-medium truncate" style="color: var(--color-text-primary)">
                {{ r.container.name }}
                <span
                  class="px-2 py-0.5 rounded-full text-xs font-medium"
                  style="background: var(--color-surface-2); color: var(--color-text-muted)"
                >
                  {{ r.categoryCount }} verschiedene Kategorien
                </span>
              </p>
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
              <p class="font-medium truncate" style="color: var(--color-text-primary)">
                {{ r.container.name }}
              </p>
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
