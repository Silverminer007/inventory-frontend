<script setup lang="ts">
  import { ref, computed, onMounted, nextTick } from 'vue'
  import { useRoute } from 'vue-router'
  import { useDatabase } from '~/composables/useDatabase'
  import { getBreadcrumb, containerConfig, type ContainerType } from '~/utils/containerUtils'

  definePageMeta({ layout: false })

  const route = useRoute()
  const db = useDatabase()

  type PrintSize = 'A4' | 'A5' | 'A6' | 'A7' | 'A8'
  const size = (route.query.size as PrintSize) ?? 'A6'

  const containerIds = ((route.query.containers as string) ?? '').split(',').filter(Boolean)
  const itemIds = ((route.query.items as string) ?? '').split(',').filter(Boolean)

  interface LabelData {
    id: string
    entityType: 'item' | 'container'
    name: string
    typeLabel: string
    path: string
    position: string
    qrUrl: string
  }

  const SIZE_CONFIG: Record<
    PrintSize,
    { perPage: number; cols: number; qrSize: number; namePx: number }
  > = {
    A4: { perPage: 1, cols: 1, qrSize: 240, namePx: 120 },
    A5: { perPage: 2, cols: 1, qrSize: 180, namePx: 96 },
    A6: { perPage: 4, cols: 2, qrSize: 150, namePx: 64 },
    A7: { perPage: 8, cols: 2, qrSize: 100, namePx: 36 },
    A8: { perPage: 16, cols: 4, qrSize: 100, namePx: 36 },
  }

  const cfg = SIZE_CONFIG[size]

  const labels = ref<LabelData[]>([])
  const isLoading = ref(true)

  // Group labels into pages
  const pages = computed(() => {
    const result: LabelData[][] = []
    for (let i = 0; i < labels.value.length; i += cfg.perPage) {
      result.push(labels.value.slice(i, i + cfg.perPage))
    }
    return result
  })

  function fitNames() {
    document.querySelectorAll<HTMLElement>('.label-name').forEach((el) => {
      const parent = el.parentElement
      if (!parent) return
      let px = cfg.namePx
      el.style.fontSize = `${px}px`
      while (el.scrollWidth > parent.clientWidth && px > 10) {
        px -= 2
        el.style.fontSize = `${px}px`
      }
    })
  }

  onMounted(async () => {
    const allContainers = await db.getAllContainers()
    const origin = window.location.origin

    for (const id of containerIds) {
      const c = allContainers.find((x) => x.id === id)
      if (!c) continue
      const crumbs = getBreadcrumb(c.id, allContainers)
      labels.value.push({
        id,
        entityType: 'container',
        name: c.name,
        typeLabel: containerConfig[c.containerType as ContainerType]?.label ?? '',
        path: crumbs.map((x) => x.name).join(' › '),
        position: c.position ?? '',
        qrUrl: `${origin}/containers/${id}`,
      })
    }

    for (const id of itemIds) {
      const item = await db.getItem(id)
      if (!item) continue
      let path = ''
      if (item.containerId) {
        const crumbs = getBreadcrumb(item.containerId, allContainers)
        path = crumbs.map((x) => x.name).join(' › ')
      }
      labels.value.push({
        id,
        entityType: 'item',
        name: item.name,
        typeLabel: 'Item',
        path,
        position: '',
        qrUrl: `${origin}/items/${id}`,
      })
    }

    isLoading.value = false
    await nextTick()
    fitNames()
    window.addEventListener('resize', fitNames)
    setTimeout(() => window.print(), 800)
  })
</script>

<template>
  <div class="print-root">
    <!-- Screen toolbar -->
    <div class="toolbar no-print">
      <span class="toolbar-info">
        {{ labels.length }} Etikett{{ labels.length !== 1 ? 'en' : '' }} · Format {{ size }}
      </span>
      <div class="flex gap-2">
        <button class="toolbar-btn" onclick="window.print()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M18 3H6v4H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2v4h12v-4h2a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2V3zm-2 2v2H8V5h8zM8 19v-6h8v6H8zm10-8a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"
            />
          </svg>
          Drucken
        </button>
        <button class="toolbar-btn secondary" onclick="window.close()">Schließen</button>
      </div>
    </div>

    <div v-if="isLoading" class="loading">Wird geladen…</div>

    <!-- Pages -->
    <template v-else>
      <div
        v-for="(page, pi) in pages"
        :key="pi"
        class="print-page"
        :class="`size-${size.toLowerCase()}`"
      >
        <div class="label-grid" :style="`grid-template-columns: repeat(${cfg.cols}, 1fr)`">
          <div v-for="label in page" :key="label.id" class="label-cell">
            <!-- Type badge -->
            <div v-if="size !== 'A8'" class="lbl-badge">
              {{ label.typeLabel }}
            </div>

            <!-- Name (JS-fitted) -->
            <div class="lbl-name-wrap">
              <div class="label-name lbl-name">
                {{ label.name }}
              </div>
            </div>

            <!-- Path -->
            <div v-if="label.path && size !== 'A8'" class="lbl-path">
              {{ label.path }}
            </div>

            <!-- Position -->
            <div v-if="label.position && size !== 'A7' && size !== 'A8'" class="lbl-position">
              📍 {{ label.position }}
            </div>

            <!-- QR code -->
            <div class="lbl-qr">
              <QrCode :value="label.qrUrl" :size="cfg.qrSize" />
              <div v-if="size !== 'A7' && size !== 'A8'" class="lbl-url">
                {{ label.qrUrl }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    background: #fff;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    color: #000;
  }

  .print-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.6rem 1rem;
    background: #f0f0f0;
    border-bottom: 1px solid #ddd;
  }
  .toolbar-info {
    font-size: 0.875rem;
    color: #555;
  }
  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.9rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    background: #1a1a1a;
    color: #fff;
  }
  .toolbar-btn.secondary {
    background: transparent;
    color: #555;
    border: 1px solid #ccc;
  }

  /* Screen: pages stacked */
  .print-page {
    padding: 12px;
    border-bottom: 2px dashed #ddd;
  }
  .print-page:last-child {
    border-bottom: none;
  }

  .label-grid {
    display: grid;
    gap: 8px;
  }

  /* Label cell */
  .label-cell {
    border: 1.5px solid #ddd;
    border-radius: 10px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    overflow: hidden;
  }

  .lbl-badge {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #666;
    border: 1px solid #aaa;
    border-radius: 99px;
    padding: 1px 8px;
    align-self: flex-start;
  }

  .lbl-name-wrap {
    width: 100%;
    overflow: hidden;
    text-align: center;
  }
  .lbl-name {
    font-weight: 900;
    line-height: 1.1;
    white-space: nowrap;
    display: block;
  }

  .lbl-path {
    font-size: 0.8rem;
    color: #444;
    text-align: center;
    word-break: break-word;
  }

  .lbl-position {
    font-size: 0.7rem;
    color: #666;
    text-align: center;
  }

  .lbl-qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-top: auto;
  }

  .lbl-url {
    font-size: 0.55rem;
    color: #bbb;
    word-break: break-all;
    text-align: center;
    max-width: 200px;
  }

  .loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    color: #666;
  }

  /* ─── Print ──────────────────────────────────────────────────────── */
  @media print {
    .no-print {
      display: none !important;
    }

    /* Default: A4 portrait (used by A5 and A7) */
    @page {
      size: A4 portrait;
      margin: 8mm;
    }

    /* Named page for A4 and A6: landscape */
    @page a4-landscape {
      size: A4 landscape;
      margin: 8mm;
    }

    body {
      background: #fff;
    }

    .print-page {
      padding: 0;
      border: none;
      width: 194mm; /* 210 - 2×8mm */
      height: 281mm; /* 297 - 2×8mm */
      break-after: page;
      break-inside: avoid;
      overflow: hidden;
    }

    /* A4 landscape: single label on landscape page */
    .size-a4 {
      page: a4-landscape;
      width: 281mm; /* 297 - 2×8mm */
      height: 194mm; /* 210 - 2×8mm */
    }

    /* A6 landscape: 4 labels on A4 landscape sheet (each label is wider than tall) */
    .size-a6 {
      page: a4-landscape;
      width: 281mm;
      height: 194mm;
    }

    .size-a8 {
      page: a4-landscape;
      width: 281mm;
      height: 194mm;
    }

    .label-grid {
      height: 100%;
      gap: 4mm;
    }

    /* A4: 1 label fills the page */
    .size-a4 .label-grid {
      grid-template-rows: 1fr;
    }
    /* A5: 2 labels stacked */
    .size-a5 .label-grid {
      grid-template-rows: 1fr 1fr;
    }
    /* A6: 2×2 */
    .size-a6 .label-grid {
      grid-template-rows: 1fr 1fr;
    }
    /* A7: 2×4 */
    .size-a7 .label-grid {
      grid-template-rows: 1fr 1fr 1fr 1fr;
    }

    .label-cell {
      border: 1px solid #ccc;
      border-radius: 4mm;
      padding: 4mm;
      overflow: hidden;
      break-inside: avoid;
    }

    .lbl-path {
      font-size: 9pt;
    }
    .lbl-position {
      font-size: 8pt;
    }
    .lbl-url {
      font-size: 6pt;
      color: #999;
    }
  }
</style>
