<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue'
  import type { Image } from '~/types/inventory'

  const props = defineProps<{
    images: Image[]
    initialIndex?: number
  }>()

  const emit = defineEmits<{ close: [] }>()

  const currentIndex = ref(props.initialIndex ?? 0)
  const current = computed(() => props.images[currentIndex.value])

  // ─── Transform ───────────────────────────────────────────────────────────────
  const scale = ref(1)
  const translateX = ref(0)
  const translateY = ref(0)

  function resetTransform() {
    scale.value = 1
    translateX.value = 0
    translateY.value = 0
  }

  // ─── Navigation ──────────────────────────────────────────────────────────────
  function goToImage(i: number) {
    currentIndex.value = i
    resetTransform()
  }

  function navigate(dir: 1 | -1) {
    const next = currentIndex.value + dir
    if (next < 0 || next >= props.images.length) return
    currentIndex.value = next
    resetTransform()
  }

  // ─── Touch tracking ──────────────────────────────────────────────────────────
  let pinchStartDistance = 0
  let pinchStartScale = 1
  let panLastX = 0
  let panLastY = 0
  let swipeStartX = 0
  let swipeStartTime = 0
  let lastTapTime = 0
  let touchMoved = false

  function touchDistance(e: TouchEvent) {
    const a = e.touches[0]!
    const b = e.touches[1]!
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
  }

  function onTouchStart(e: TouchEvent) {
    e.preventDefault()
    touchMoved = false
    if (e.touches.length === 2) {
      pinchStartDistance = touchDistance(e)
      pinchStartScale = scale.value
    } else {
      const t = e.touches[0]!
      panLastX = t.clientX
      panLastY = t.clientY
      swipeStartX = t.clientX
      swipeStartTime = Date.now()
    }
  }

  function onTouchMove(e: TouchEvent) {
    e.preventDefault()
    touchMoved = true
    if (e.touches.length === 2) {
      const dist = touchDistance(e)
      scale.value = Math.min(Math.max(pinchStartScale * (dist / pinchStartDistance), 1), 6)
    } else if (e.touches.length === 1) {
      const t = e.touches[0]!
      if (scale.value > 1) {
        translateX.value += t.clientX - panLastX
        translateY.value += t.clientY - panLastY
      }
      panLastX = t.clientX
      panLastY = t.clientY
    }
  }

  function onTouchEnd(e: TouchEvent) {
    const endX = e.changedTouches[0]?.clientX ?? swipeStartX
    const dx = endX - swipeStartX
    const dt = Date.now() - swipeStartTime

    if (!touchMoved && dt < 400) {
      // Tap — check for double tap
      const now = Date.now()
      if (now - lastTapTime < 350) {
        if (scale.value > 1) {
          resetTransform()
        } else {
          scale.value = 2.5
        }
        lastTapTime = 0
      } else {
        lastTapTime = now
      }
      return
    }

    // Swipe navigation when not zoomed
    if (scale.value <= 1 && Math.abs(dx) > 60 && dt < 450) {
      navigate(dx < 0 ? 1 : -1)
      return
    }

    // Clamp scale
    if (scale.value < 1) resetTransform()
  }

  // ─── Wheel zoom (desktop) ────────────────────────────────────────────────────
  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.15 : 0.87
    scale.value = Math.min(Math.max(scale.value * factor, 1), 6)
    if (scale.value <= 1) resetTransform()
  }

  // ─── Double-click zoom (desktop) ─────────────────────────────────────────────
  function onDblClick() {
    if (scale.value > 1) {
      resetTransform()
    } else {
      scale.value = 2.5
    }
  }

  // ─── Keyboard ────────────────────────────────────────────────────────────────
  function onKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowLeft':
        navigate(-1)
        break
      case 'ArrowRight':
        navigate(1)
        break
      case 'Escape':
        emit('close')
        break
      case '+':
        scale.value = Math.min(scale.value * 1.2, 6)
        break
      case '-':
        scale.value = Math.max(scale.value * 0.8, 1)
        if (scale.value <= 1) resetTransform()
        break
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex flex-col"
    style="background: #000; touch-action: none"
    role="dialog"
    aria-modal="true"
  >
    <!-- ─── Top bar ─────────────────────────────────────────────────────────── -->
    <div
      class="flex items-center justify-between px-3 py-2 shrink-0"
      style="background: rgba(0, 0, 0, 0.6)"
    >
      <button
        class="w-10 h-10 flex items-center justify-center rounded-full"
        style="color: white"
        aria-label="Schließen"
        @click="emit('close')"
      >
        <Icon icon="mdi:close" class="w-6 h-6" />
      </button>
      <span v-if="images.length > 1" class="text-sm" style="color: rgba(255, 255, 255, 0.75)">
        {{ currentIndex + 1 }} / {{ images.length }}
      </span>
      <div class="w-10" />
    </div>

    <!-- ─── Image ──────────────────────────────────────────────────────────── -->
    <div
      class="flex-1 flex items-center justify-center overflow-hidden"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @wheel.prevent="onWheel"
      @dblclick="onDblClick"
    >
      <img
        v-if="current"
        :src="current.url"
        :alt="current.filename ?? ''"
        class="max-w-full max-h-full object-contain select-none"
        :style="{
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
          cursor: scale > 1 ? 'grab' : 'zoom-in',
          willChange: 'transform',
          transition: 'none',
        }"
        draggable="false"
        @dragstart.prevent
      />
    </div>

    <!-- ─── Desktop nav arrows ────────────────────────────────────────────── -->
    <button
      v-if="currentIndex > 0"
      class="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full items-center justify-center hidden lg:flex"
      style="background: rgba(255, 255, 255, 0.15); color: white"
      aria-label="Vorheriges Bild"
      @click="navigate(-1)"
    >
      <Icon icon="mdi:chevron-left" class="w-7 h-7" />
    </button>
    <button
      v-if="currentIndex < images.length - 1"
      class="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full items-center justify-center hidden lg:flex"
      style="background: rgba(255, 255, 255, 0.15); color: white"
      aria-label="Nächstes Bild"
      @click="navigate(1)"
    >
      <Icon icon="mdi:chevron-right" class="w-7 h-7" />
    </button>

    <!-- ─── Dot navigation ────────────────────────────────────────────────── -->
    <div v-if="images.length > 1" class="flex justify-center items-center gap-1.5 py-4 shrink-0">
      <button
        v-for="(_, i) in images"
        :key="i"
        class="h-2 rounded-full transition-all duration-200"
        :style="
          i === currentIndex
            ? 'width: 1.5rem; background: white'
            : 'width: 0.5rem; background: rgba(255,255,255,0.35)'
        "
        :aria-label="`Bild ${i + 1}`"
        @click="goToImage(i)"
      />
    </div>
  </div>
</template>
