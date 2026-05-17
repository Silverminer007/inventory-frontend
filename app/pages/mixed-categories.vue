<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { containerConfig } from '~/utils/containerUtils'
  import { useMixedCategories, type CategoryConflict } from '~/composables/useMixedCategories'

  const { findConflicts } = useMixedCategories()

  const error = ref<string | null>(null)
  const isLoading = ref(false)
  const conflicts = ref<CategoryConflict[]>([])

  const showEmpty = computed(() => !isLoading.value && conflicts.value.length === 0)

  const sections = computed(() =>
    [
      {
        type: 'BOX' as const,
        label: 'Kisten',
        items: conflicts.value.filter((r) => r.container?.containerType === 'BOX'),
      },
      {
        type: 'SHELF' as const,
        label: 'Regale',
        items: conflicts.value.filter((r) => r.container?.containerType === 'SHELF'),
      },
    ].filter((s) => s.items.length > 0),
  )

  onMounted(async () => {
    isLoading.value = true
    try {
      conflicts.value = await findConflicts()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Fehler beim Laden'
    } finally {
      isLoading.value = false
    }
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
    <div v-if="isLoading" class="flex justify-center py-8">
      <LoadingSpinner />
    </div>

    <!-- No results -->
    <EmptyState
      v-else-if="showEmpty"
      icon="mdi:text-search"
      title="Keine gemischten Kisten oder Regale"
      data-testid="empty-state"
    />

    <!-- Results -->
    <div v-else class="space-y-5">
      <section v-for="section in sections" :key="section.type">
        <div class="flex items-center gap-2 mb-2">
          <Icon
            :icon="containerConfig[section.type].icon"
            class="w-4 h-4"
            style="color: var(--color-text-muted)"
          />
          <span
            class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--color-text-muted)"
          >
            {{ section.label }} ({{ section.items.length }})
          </span>
        </div>
        <div class="space-y-2">
          <NuxtLink
            v-for="r in section.items"
            :key="r.container!.id"
            :to="`/containers/${r.container!.id}`"
            class="card flex items-center gap-3 active:opacity-70 transition-opacity"
          >
            <Icon
              :icon="containerConfig[section.type].icon"
              class="w-5 h-5 shrink-0"
              style="color: var(--color-accent)"
            />
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate" style="color: var(--color-text-primary)">
                {{ r.container?.name }}
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
    </div>
  </div>
</template>
