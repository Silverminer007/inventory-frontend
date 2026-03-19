<script setup lang="ts">
  export type PrintSize = 'A4' | 'A5' | 'A6' | 'A7'

  const emit = defineEmits<{
    select: [size: PrintSize]
    close: []
  }>()

  const sizes: Array<{
    size: PrintSize
    desc: string
    mm: string
    perPage: number
    cols: number
    rows: number
  }> = [
    { size: 'A7', desc: 'Klein', mm: '74 × 105 mm', perPage: 8, cols: 2, rows: 4 },
    { size: 'A6', desc: 'Mittel', mm: '105 × 148 mm', perPage: 4, cols: 2, rows: 2 },
    { size: 'A5', desc: 'Groß', mm: '148 × 210 mm', perPage: 2, cols: 1, rows: 2 },
    { size: 'A4', desc: 'Ganzseitig', mm: '210 × 297 mm', perPage: 1, cols: 1, rows: 1 },
  ]
</script>

<template>
  <BottomSheet title="Etikettenformat wählen" @close="emit('close')">
    <div class="space-y-2">
      <button
        v-for="s in sizes"
        :key="s.size"
        class="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-colors"
        style="background: var(--color-surface-2)"
        @click="emit('select', s.size)"
      >
        <!-- Mini grid preview -->
        <div
          class="shrink-0 w-10 h-10 rounded-lg p-1 grid gap-0.5"
          style="background: var(--color-surface-0)"
          :style="`grid-template-columns: repeat(${s.cols}, 1fr); grid-template-rows: repeat(${s.rows}, 1fr)`"
        >
          <div
            v-for="n in s.cols * s.rows"
            :key="n"
            class="rounded-sm"
            style="background: var(--color-accent); opacity: 0.7"
          />
        </div>

        <div class="flex-1 min-w-0">
          <p class="font-semibold" style="color: var(--color-text-primary)">
            {{ s.size }} — {{ s.desc }}
          </p>
          <p class="text-sm" style="color: var(--color-text-muted)">
            {{ s.mm }} · {{ s.perPage }} pro Blatt
          </p>
        </div>

        <Icon
          icon="mdi:chevron-right"
          class="w-5 h-5 shrink-0"
          style="color: var(--color-text-muted)"
        />
      </button>
    </div>
  </BottomSheet>
</template>
