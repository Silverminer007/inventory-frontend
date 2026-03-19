<script setup lang="ts">
  import { ref, onMounted, watch } from 'vue'
  import QRCode from 'qrcode'

  const props = defineProps<{
    value: string
    size?: number
  }>()

  const canvasRef = ref<HTMLCanvasElement | null>(null)

  async function render() {
    if (!canvasRef.value || !props.value) return
    await QRCode.toCanvas(canvasRef.value, props.value, {
      width: props.size ?? 240,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
  }

  onMounted(render)
  watch(() => props.value, render)
</script>

<template>
  <canvas ref="canvasRef" class="rounded-xl" />
</template>
