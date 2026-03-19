<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import Fuse from 'fuse.js'
  import { useSearch } from '~/composables/useSearch'

  const props = defineProps<{
    modelValue: string[]
  }>()

  const emit = defineEmits<{
    'update:modelValue': [tags: string[]]
  }>()

  const search = useSearch()
  const tagQuery = ref('')
  const allTags = ref<{ tag: string; count: number }[]>([])

  onMounted(async () => {
    allTags.value = await search.getAllTags()
  })

  const tagFuse = computed(
    () =>
      new Fuse(allTags.value, {
        keys: ['tag'],
        threshold: 0.4,
        minMatchCharLength: 1,
      }),
  )

  const filteredSuggestions = computed(() => {
    const inactive = allTags.value.filter((t) => !props.modelValue.includes(t.tag))
    if (!tagQuery.value.trim()) return inactive
    return tagFuse.value.search(tagQuery.value).map((r) => r.item)
  })

  function addTag(tag: string) {
    if (!props.modelValue.includes(tag)) {
      emit('update:modelValue', [...props.modelValue, tag])
    }
  }

  function removeTag(tag: string) {
    emit(
      'update:modelValue',
      props.modelValue.filter((t) => t !== tag),
    )
  }
</script>

<template>
  <div class="space-y-3" data-testid="tag-filter">
    <!-- Search field -->
    <div class="relative">
      <Icon
        icon="mdi:magnify"
        class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
        style="color: var(--color-text-muted)"
      />
      <input
        v-model="tagQuery"
        type="text"
        placeholder="Tags filtern…"
        class="search-input"
        style="
          padding-left: 2.25rem;
          padding-right: 0.875rem;
          padding-top: 0.5rem;
          padding-bottom: 0.5rem;
          font-size: 0.875rem;
        "
        data-testid="tag-search-input"
      />
    </div>

    <!-- Active tags -->
    <div v-if="modelValue.length > 0">
      <p
        class="text-xs font-semibold uppercase tracking-wide mb-2"
        style="color: var(--color-text-muted)"
      >
        Aktive Filter
      </p>
      <div class="flex flex-wrap gap-2" data-testid="selected-tags">
        <button
          v-for="tag in modelValue"
          :key="tag"
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium"
          style="background: var(--color-nav-active-bg); color: var(--color-nav-active-text)"
          @click="removeTag(tag)"
        >
          {{ tag }}
          <Icon icon="mdi:close" class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Suggestions -->
    <div v-if="filteredSuggestions.length > 0">
      <p
        class="text-xs font-semibold uppercase tracking-wide mb-2"
        style="color: var(--color-text-muted)"
      >
        Vorschläge
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="{ tag, count } in filteredSuggestions"
          :key="tag"
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm transition-colors"
          style="background: var(--color-surface-2); color: var(--color-text-secondary)"
          @click="addTag(tag)"
        >
          <Icon icon="mdi:plus" class="w-3 h-3" />
          {{ tag }}
          <span class="text-xs opacity-60">{{ count }}</span>
        </button>
      </div>
    </div>

    <div
      v-else-if="allTags.length === 0"
      class="py-2 text-sm text-center"
      style="color: var(--color-text-muted)"
    >
      Keine Tags vorhanden
    </div>
  </div>
</template>
