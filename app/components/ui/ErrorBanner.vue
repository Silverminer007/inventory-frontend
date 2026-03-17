<script setup lang="ts">
defineProps<{
  message: string
}>()

const emit = defineEmits<{
  dismiss: []
}>()
</script>

<template>
  <div
    role="alert"
    class="flex items-start gap-3 rounded-xl p-4 animate-fade-in"
    style="
      background: var(--color-danger-bg);
      border: 1px solid var(--color-danger-border);
    "
  >
    <Icon
      icon="mdi:alert-circle-outline"
      class="w-5 h-5 mt-0.5 shrink-0"
      style="color: var(--color-danger-text)"
    />
    <p class="flex-1 text-sm font-medium" style="color: var(--color-danger-text)">
      {{ message }}
    </p>
    <button
      class="shrink-0 p-0.5 rounded"
      style="color: var(--color-danger-text)"
      aria-label="Schließen"
      @click="emit('dismiss')"
    >
      <Icon icon="mdi:close" class="w-4 h-4" />
    </button>
  </div>
</template>
