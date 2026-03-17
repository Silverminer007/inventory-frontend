<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
  actionLabel?: string
}>()

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 px-6 text-center" data-testid="empty-state">
    <div
      v-if="icon"
      class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
      style="background: var(--color-surface-2)"
    >
      <Icon :icon="icon" class="w-8 h-8" style="color: var(--color-text-muted)" />
    </div>
    <h3 class="text-base font-semibold mb-1" style="color: var(--color-text-primary)">
      {{ title }}
    </h3>
    <p v-if="description" class="text-sm mb-6" style="color: var(--color-text-muted)">
      {{ description }}
    </p>
    <button
      v-if="actionLabel"
      class="btn btn-primary"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>
