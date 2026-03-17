<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}>(), {
  confirmLabel: 'Bestätigen',
  cancelLabel: 'Abbrechen',
  danger: false
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <BottomSheet @close="emit('cancel')">
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-semibold" style="color: var(--color-text-primary)">
          {{ title }}
        </h3>
        <p v-if="description" class="text-sm mt-1" style="color: var(--color-text-secondary)">
          {{ description }}
        </p>
      </div>
      <div class="flex flex-col gap-2 pt-2">
        <button
          :class="['btn w-full', danger ? 'btn-danger' : 'btn-primary']"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
        <button
          class="btn btn-secondary w-full"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
      </div>
    </div>
  </BottomSheet>
</template>
