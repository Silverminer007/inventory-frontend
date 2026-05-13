<script setup lang="ts">
  import { computed } from 'vue'
  import type { Category } from '~/types/inventory'

  const props = defineProps<{
    modelValue: string[]
    allCategories: Category[]
  }>()

  const emit = defineEmits<{
    'update:modelValue': [ids: string[]]
  }>()

  const activeCategories = computed(() =>
    props.allCategories.filter((c) => props.modelValue.includes(c.id)),
  )

  const suggestions = computed(() =>
    props.allCategories.filter((c) => !props.modelValue.includes(c.id)),
  )

  function addCategory(id: string) {
    if (!props.modelValue.includes(id)) {
      emit('update:modelValue', [...props.modelValue, id])
    }
  }

  function removeCategory(id: string) {
    emit(
      'update:modelValue',
      props.modelValue.filter((i) => i !== id),
    )
  }
</script>

<template>
  <div class="space-y-3" data-testid="category-filter">
    <!-- Active categories -->
    <div v-if="activeCategories.length > 0">
      <p
        class="text-xs font-semibold uppercase tracking-wide mb-2"
        style="color: var(--color-text-muted)"
      >
        Aktive Filter
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="cat in activeCategories"
          :key="cat.id"
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium"
          style="background: var(--color-nav-active-bg); color: var(--color-nav-active-text)"
          @click="removeCategory(cat.id)"
        >
          <span class="font-mono font-bold text-xs uppercase" style="color: var(--color-accent)">
            {{ cat.shortCode }}
          </span>
          {{ cat.name }}
          <Icon icon="mdi:close" class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Suggestions -->
    <div v-if="suggestions.length > 0">
      <p
        class="text-xs font-semibold uppercase tracking-wide mb-2"
        style="color: var(--color-text-muted)"
      >
        Kategorien
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="cat in suggestions"
          :key="cat.id"
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm transition-colors"
          style="background: var(--color-surface-2); color: var(--color-text-secondary)"
          @click="addCategory(cat.id)"
        >
          <Icon icon="mdi:plus" class="w-3 h-3" />
          <span class="font-mono font-bold text-xs uppercase" style="color: var(--color-accent)">
            {{ cat.shortCode }}
          </span>
          {{ cat.name }}
        </button>
      </div>
    </div>

    <div
      v-else-if="allCategories.length === 0"
      class="py-2 text-sm text-center"
      style="color: var(--color-text-muted)"
    >
      Keine Kategorien vorhanden
    </div>
    <div v-else class="py-2 text-sm text-center" style="color: var(--color-text-muted)">
      Alle Kategorien ausgewählt
    </div>
  </div>
</template>
