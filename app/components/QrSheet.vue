<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{
    entityType: 'item' | 'container'
    entityId: string
    name: string
  }>()

  const emit = defineEmits<{ close: [] }>()

  const url = computed(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/${props.entityType}s/${props.entityId}`
  })

  async function copyUrl() {
    if (!url.value) return
    await navigator.clipboard.writeText(url.value).catch(() => {})
  }

  function openPrint() {
    const params = new URLSearchParams({ type: props.entityType, id: String(props.entityId) })
    window.open(
      `/print?${params}`,
      '_blank',
      'width=900,height=700,menubar=no,toolbar=no,location=no',
    )
  }
</script>

<template>
  <BottomSheet :title="`QR-Code: ${name}`" @close="emit('close')">
    <div class="flex flex-col items-center gap-4 py-2">
      <div class="p-3 rounded-2xl" style="background: #fff">
        <QrCode :value="url" :size="220" />
      </div>

      <p class="text-xs text-center px-4 break-all" style="color: var(--color-text-muted)">
        {{ url }}
      </p>

      <div class="flex gap-3 w-full">
        <button class="btn btn-secondary flex-1" @click="copyUrl">
          <Icon icon="mdi:content-copy" class="w-4 h-4" />
          URL kopieren
        </button>
        <button class="btn btn-primary flex-1" @click="openPrint">
          <Icon icon="mdi:printer-outline" class="w-4 h-4" />
          Drucken
        </button>
      </div>
    </div>
  </BottomSheet>
</template>
