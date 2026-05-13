<script setup lang="ts">
  import { ref } from 'vue'
  import type { CategoryInfo } from '~/types/inventory'

  defineProps<{ modelValue: CategoryInfo | null; required?: boolean }>()
  const emit = defineEmits<{ 'update:modelValue': [CategoryInfo | null] }>()

  const showPicker = ref(false)

  function onSelect(cat: CategoryInfo | null) {
    emit('update:modelValue', cat)
    showPicker.value = false
  }
</script>

<template>
  <div>
    <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
      Kategorie
      <span v-if="required"> *</span>
      <span v-else style="color: var(--color-text-muted)"> (optional)</span>
    </label>
    <button
      type="button"
      class="search-input w-full text-left flex items-center justify-between"
      style="padding-left: 0.875rem; padding-right: 0.875rem"
      @click="showPicker = true"
    >
      <span v-if="modelValue" class="flex items-center gap-2">
        <span
          class="px-2 py-0.5 rounded-md text-xs font-mono font-bold uppercase"
          style="background: var(--color-nav-active-bg); color: var(--color-accent)"
        >
          {{ modelValue.shortCode }}
        </span>
        <span style="color: var(--color-text-primary)">{{ modelValue.name }}</span>
      </span>
      <span v-else style="color: var(--color-text-muted)">Kategorie wählen…</span>
      <Icon
        icon="mdi:chevron-right"
        class="w-4 h-4 shrink-0"
        style="color: var(--color-text-muted)"
      />
    </button>
  </div>

  <CategoryPicker
    v-if="showPicker"
    :selected-id="modelValue?.id"
    @select="onSelect"
    @close="showPicker = false"
  />
</template>
