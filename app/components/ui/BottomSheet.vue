<script setup lang="ts">
defineProps<{
  title?: string
}>()

const emit = defineEmits<{
  close: []
}>()

function onBackdropClick() {
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      class="bottom-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      @click.self="onBackdropClick"
      @keydown="onKeydown"
    >
      <div class="bottom-sheet-content">
        <!-- Drag handle -->
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 rounded-full" style="background: var(--color-border)" />
        </div>

        <!-- Header -->
        <div v-if="title || $slots.header" class="flex items-center justify-between px-4 py-3">
          <slot name="header">
            <h2 class="text-lg font-semibold" style="color: var(--color-text-primary)">
              {{ title }}
            </h2>
          </slot>
          <button
            class="btn btn-ghost p-2 -mr-2"
            aria-label="Schließen"
            @click="emit('close')"
          >
            <Icon icon="mdi:close" class="w-5 h-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="px-4 pb-4">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
