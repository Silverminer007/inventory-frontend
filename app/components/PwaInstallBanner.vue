<script setup lang="ts">
import { ref, onMounted } from 'vue'

const visible = ref(false)
let deferredPrompt: Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null = null

const STORAGE_KEY = 'pwa-install-dismissed'
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    return Date.now() - parseInt(raw) < THIRTY_DAYS
  } catch {
    return false
  }
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

onMounted(() => {
  if (isStandalone() || isDismissed()) return

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as typeof deferredPrompt
    setTimeout(() => { visible.value = true }, 2000)
  })
})

async function install() {
  if (!deferredPrompt) return
  await deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice
  if (choice.outcome === 'accepted') {
    dismiss()
  }
}

function dismiss() {
  visible.value = false
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {
    // localStorage might be unavailable
  }
}
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="visible"
      class="fixed bottom-20 left-4 right-4 z-30 rounded-2xl shadow-lg p-4 flex items-center gap-3 animate-slide-up lg:hidden"
      style="background: var(--color-install-banner-bg); color: var(--color-install-banner-text)"
      role="banner"
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style="background: rgba(255,255,255,0.15)"
      >
        <Icon icon="mdi:package-variant" class="w-6 h-6" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold">App installieren</p>
        <p class="text-xs" style="color: var(--color-install-banner-sub)">Für Offline-Nutzung verfügbar machen</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          class="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style="background: var(--color-accent)"
          @click="install"
        >
          Installieren
        </button>
        <button
          class="p-1.5 rounded-lg opacity-60 hover:opacity-100"
          aria-label="Schließen"
          @click="dismiss"
        >
          <Icon icon="mdi:close" class="w-4 h-4" />
        </button>
      </div>
    </div>
  </Transition>
</template>
