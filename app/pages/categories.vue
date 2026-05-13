<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { useDatabase } from '~/composables/useDatabase'
  import type { Category } from '~/types/inventory'
  import type { UUID } from '~/utils/uuid'

  const db = useDatabase()

  const categories = ref<Category[]>([])
  const showAddSheet = ref(false)
  const editingCategory = ref<Category | null>(null)

  async function loadData() {
    categories.value = await db.getAllCategories()
  }

  function onCreated(cat: Category) {
    showAddSheet.value = false
    categories.value = [...categories.value, cat]
  }

  function onUpdated(cat: Category) {
    editingCategory.value = null
    categories.value = categories.value.map((c) => (c.id === cat.id ? cat : c))
  }

  function onDeleted(id: UUID) {
    editingCategory.value = null
    categories.value = categories.value.filter((c) => c.id !== id)
  }

  onMounted(loadData)
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-6">
    <!-- Page header -->
    <div class="flex items-center gap-3 mb-6">
      <h1 class="text-xl font-bold" style="color: var(--color-text-primary)">Kategorien</h1>
      <span
        v-if="categories.length > 0"
        class="px-2 py-0.5 rounded-full text-xs font-medium"
        style="background: var(--color-surface-2); color: var(--color-text-muted)"
      >
        {{ categories.length }}
      </span>
    </div>

    <!-- Category list -->
    <div v-if="categories.length > 0" class="space-y-2">
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="card w-full text-left flex items-center gap-4 active:opacity-70 transition-opacity"
        @click="editingCategory = cat"
      >
        <!-- Short code badge -->
        <div
          class="shrink-0 px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase"
          style="background: var(--color-nav-active-bg); color: var(--color-accent)"
        >
          {{ cat.shortCode }}
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <p class="font-semibold truncate" style="color: var(--color-text-primary)">
            {{ cat.name }}
          </p>
          <p v-if="cat.description" class="text-sm truncate" style="color: var(--color-text-muted)">
            {{ cat.description }}
          </p>
        </div>

        <!-- Chevron -->
        <Icon
          icon="mdi:chevron-right"
          class="w-5 h-5 shrink-0"
          style="color: var(--color-text-muted)"
        />
      </button>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else
      icon="mdi:tag-multiple-outline"
      title="Noch keine Kategorien"
      description="Füge deine erste Kategorie hinzu."
      action-label="Kategorie hinzufügen"
      @action="showAddSheet = true"
    />

    <!-- FAB -->
    <button
      v-if="categories.length > 0"
      class="fixed bottom-20 right-4 z-10 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center lg:bottom-6"
      style="background: var(--color-accent)"
      aria-label="Kategorie hinzufügen"
      @click="showAddSheet = true"
    >
      <Icon icon="mdi:plus" class="w-7 h-7 text-white" />
    </button>

    <!-- Create sheet -->
    <CategoryForm v-if="showAddSheet" @created="onCreated" @close="showAddSheet = false" />

    <!-- Edit sheet -->
    <CategoryEditForm
      v-if="editingCategory"
      :category="editingCategory"
      @updated="onUpdated"
      @deleted="onDeleted(editingCategory!.id)"
      @close="editingCategory = null"
    />
  </div>
</template>
