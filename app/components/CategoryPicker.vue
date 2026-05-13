<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useDatabase } from '~/composables/useDatabase'
  import type { CategoryInfo } from '~/types/inventory'
  import type { UUID } from '~/utils/uuid'

  const props = defineProps<{
    selectedId?: UUID
    categories?: CategoryInfo[]
  }>()

  const emit = defineEmits<{
    select: [category: CategoryInfo | null]
    close: []
  }>()

  const db = useDatabase()
  const loadedCategories = ref<CategoryInfo[]>([])

  onMounted(async () => {
    if (!props.categories) {
      loadedCategories.value = await db.getAllCategories()
    }
  })

  // Use prop if provided; fall back to DB-loaded list
  const visibleCategories = computed(() => props.categories ?? loadedCategories.value)
</script>

<template>
  <BottomSheet title="Kategorie wählen" @close="emit('close')">
    <div class="space-y-1 max-h-[50vh] overflow-y-auto">
      <!-- Clear option -->
      <button
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:opacity-80"
        style="color: var(--color-text-muted)"
        @click="emit('select', null)"
      >
        <Icon icon="mdi:tag-off-outline" class="w-5 h-5 shrink-0" />
        <span class="text-sm">Keine Kategorie</span>
      </button>

      <!-- Category rows -->
      <button
        v-for="cat in visibleCategories"
        :key="cat.id"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:opacity-80"
        :style="cat.id === selectedId ? 'background: var(--color-nav-active-bg)' : ''"
        @click="emit('select', cat)"
      >
        <span
          class="shrink-0 px-2 py-0.5 rounded-md text-xs font-mono font-bold uppercase"
          style="background: var(--color-nav-active-bg); color: var(--color-accent)"
        >
          {{ cat.shortCode }}
        </span>
        <span class="flex-1 text-left text-sm" style="color: var(--color-text-primary)">
          {{ cat.name }}
        </span>
        <Icon
          v-if="cat.id === selectedId"
          icon="mdi:check"
          class="w-4 h-4 shrink-0"
          style="color: var(--color-accent)"
        />
      </button>

      <!-- Empty state -->
      <p
        v-if="visibleCategories.length === 0"
        class="py-8 text-center text-sm"
        style="color: var(--color-text-muted)"
      >
        Noch keine Kategorien angelegt
      </p>
    </div>
  </BottomSheet>
</template>
