<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  detected: [value: string]
  close: []
}>()

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] })
  detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<Array<{ rawValue: string; format: string }>>
}

const videoRef = ref<HTMLVideoElement | null>(null)
const isSupported = ref(false)
const cameraError = ref<string | null>(null)
const isReady = ref(false)

let stream: MediaStream | null = null
let detector: BarcodeDetector | null = null
let rafId: number | null = null

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      videoRef.value.onloadedmetadata = () => {
        videoRef.value?.play()
        isReady.value = true
        scanLoop()
      }
    }
  } catch {
    cameraError.value = 'Kamera konnte nicht geöffnet werden. Bitte Berechtigung prüfen.'
  }
}

async function scanLoop() {
  if (!videoRef.value || !detector || videoRef.value.readyState < 2) {
    rafId = requestAnimationFrame(scanLoop)
    return
  }
  try {
    const results = await detector.detect(videoRef.value)
    if (results.length > 0 && results[0]) {
      emit('detected', results[0].rawValue)
      return
    }
  } catch { /* frame not ready — continue */ }
  rafId = requestAnimationFrame(scanLoop)
}

function stopCamera() {
  if (rafId !== null) cancelAnimationFrame(rafId)
  stream?.getTracks().forEach(t => t.stop())
}

onMounted(() => {
  isSupported.value = 'BarcodeDetector' in window
  if (!isSupported.value) return

  detector = new BarcodeDetector({
    formats: ['ean_13', 'ean_8', 'qr_code', 'code_128', 'code_39', 'upc_a', 'upc_e', 'data_matrix']
  })
  startCamera()
})

onUnmounted(stopCamera)
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col" style="background: #000">
    <!-- Not supported -->
    <div
      v-if="!isSupported"
      class="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <Icon icon="mdi:barcode-off" class="w-14 h-14 text-white opacity-60" />
      <p class="text-white text-base font-medium">Barcode-Scanner nicht verfügbar</p>
      <p class="text-sm opacity-60 text-white">
        Dein Browser unterstützt die BarcodeDetector-API nicht.<br />
        Bitte trage den Barcode manuell ein.
      </p>
      <button class="btn btn-secondary mt-2" @click="emit('close')">Schließen</button>
    </div>

    <template v-else>
      <!-- Camera error -->
      <div
        v-if="cameraError"
        class="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center"
      >
        <Icon icon="mdi:camera-off" class="w-14 h-14 text-white opacity-60" />
        <p class="text-white text-sm opacity-80">{{ cameraError }}</p>
        <button class="btn btn-secondary" @click="emit('close')">Schließen</button>
      </div>

      <template v-else>
        <!-- Video feed -->
        <video
          ref="videoRef"
          class="absolute inset-0 w-full h-full object-cover"
          playsinline
          muted
          autoplay
        />

        <!-- Viewfinder overlay -->
        <div class="relative flex-1 flex flex-col items-center justify-center">
          <!-- Dark borders around viewfinder -->
          <div class="absolute inset-0" style="background: rgba(0,0,0,0.5)" />

          <!-- Viewfinder window -->
          <div
            class="relative w-64 h-44 rounded-2xl overflow-hidden"
            style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.5)"
          >
            <!-- Corner markers -->
            <div class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl opacity-90" />
            <div class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl opacity-90" />
            <div class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl opacity-90" />
            <div class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl opacity-90" />

            <!-- Scan line -->
            <div
              v-if="isReady"
              class="absolute left-2 right-2 h-0.5 opacity-80"
              style="background: var(--color-accent); animation: scan-line 2s ease-in-out infinite"
            />
          </div>

          <!-- Label -->
          <p class="relative mt-6 text-sm text-white opacity-80">
            {{ isReady ? 'Barcode in den Rahmen halten' : 'Kamera wird geöffnet…' }}
          </p>
        </div>

        <!-- Close button -->
        <div class="relative flex justify-center pb-12 pt-4">
          <button
            class="w-14 h-14 rounded-full flex items-center justify-center"
            style="background: rgba(255,255,255,0.2)"
            @click="emit('close')"
          >
            <Icon icon="mdi:close" class="w-7 h-7 text-white" />
          </button>
        </div>
      </template>
    </template>
  </div>
</template>

<style>
@keyframes scan-line {
  0%   { top: 10%; }
  50%  { top: 80%; }
  100% { top: 10%; }
}
</style>
