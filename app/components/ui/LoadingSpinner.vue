<script setup lang="ts">
  withDefaults(
    defineProps<{
      size?: 'sm' | 'md' | 'lg'
    }>(),
    { size: 'md' },
  )

  const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
</script>

<template>
  <div
    role="status"
    aria-label="Laden…"
    :class="['animate-spin rounded-full border-2', sizeMap[size]]"
    style="border-color: var(--color-border); border-top-color: var(--color-accent)"
  />
</template>
