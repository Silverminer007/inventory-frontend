<script setup lang="ts">
import type { ContainerDTO } from '~/types'

const props = defineProps<{
  sourceId?: number | null
  sourceType: 'container' | 'item'
}>()

const emit = defineEmits<{
  moved: []
}>()

const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { move: moveContainer, fetchAllFlat } = useContainers()
const { move: moveItem } = useItems()

const containers = ref<ContainerDTO[]>([])
const selectedId = ref<number | null>(null)
const loading = ref(false)
const moving = ref(false)

watch(open, async (val) => {
  if (val) {
    loading.value = true
    try {
      containers.value = await fetchAllFlat()
    } finally {
      loading.value = false
    }
    selectedId.value = null
  }
})

function containerIcon(type: string) {
  switch (type) {
    case 'ROOM': return 'i-lucide-door-open'
    case 'SHELF': return 'i-lucide-rows-3'
    case 'BOX': return 'i-lucide-box'
    default: return 'i-lucide-folder'
  }
}

// Build tree from flat list
const rootContainers = computed(() => {
  return containers.value.filter(c => !c.parentContainerId)
})

function getChildrenOf(parentId: number): ContainerDTO[] {
  return containers.value.filter(c => c.parentContainerId === parentId)
}

async function doMove() {
  if (!props.sourceId) return
  moving.value = true
  try {
    if (props.sourceType === 'container') {
      await moveContainer(props.sourceId, { parentContainerId: selectedId.value })
    } else {
      await moveItem(props.sourceId, { containerId: selectedId.value })
    }
    toast.add({ title: 'Verschoben', color: 'success' })
    open.value = false
    emit('moved')
  } catch (e: any) {
    toast.add({ title: 'Fehler', description: e?.data?.message || 'Verschieben fehlgeschlagen', color: 'error' })
  } finally {
    moving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4">
          {{ sourceType === 'container' ? 'Container' : 'Gegenstand' }} verschieben
        </h3>

        <div v-if="loading" class="space-y-2">
          <USkeleton v-for="i in 4" :key="i" class="h-10 rounded-lg" />
        </div>

        <div v-else class="max-h-80 overflow-y-auto space-y-1">
          <!-- Root option (no parent) -->
          <button
            v-if="sourceType === 'container'"
            class="w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors"
            :class="selectedId === null ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-elevated'"
            @click="selectedId = null"
          >
            <UIcon name="i-lucide-home" class="text-muted" />
            <span class="text-sm font-medium">Root (kein Eltern-Container)</span>
          </button>

          <!-- Container tree -->
          <template v-for="root in rootContainers" :key="root.id">
            <button
              class="w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors"
              :class="selectedId === root.id ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-elevated'"
              :disabled="root.id === sourceId"
              @click="selectedId = root.id!"
            >
              <UIcon :name="containerIcon(root.containerType)" class="text-primary" />
              <span class="text-sm font-medium" :class="root.id === sourceId ? 'text-muted line-through' : ''">
                {{ root.name }}
              </span>
            </button>
            <!-- Level 2 -->
            <template v-for="child in getChildrenOf(root.id!)" :key="child.id">
              <button
                class="w-full flex items-center gap-3 p-2.5 pl-8 rounded-lg text-left transition-colors"
                :class="selectedId === child.id ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-elevated'"
                :disabled="child.id === sourceId"
                @click="selectedId = child.id!"
              >
                <UIcon :name="containerIcon(child.containerType)" class="text-primary" />
                <span class="text-sm" :class="child.id === sourceId ? 'text-muted line-through' : ''">
                  {{ child.name }}
                </span>
              </button>
              <!-- Level 3 -->
              <button
                v-for="grandchild in getChildrenOf(child.id!)"
                :key="grandchild.id"
                class="w-full flex items-center gap-3 p-2.5 pl-14 rounded-lg text-left transition-colors"
                :class="selectedId === grandchild.id ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-elevated'"
                :disabled="grandchild.id === sourceId"
                @click="selectedId = grandchild.id!"
              >
                <UIcon :name="containerIcon(grandchild.containerType)" class="text-primary" />
                <span class="text-sm" :class="grandchild.id === sourceId ? 'text-muted line-through' : ''">
                  {{ grandchild.name }}
                </span>
              </button>
            </template>
          </template>
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-default mt-4">
          <UButton label="Abbrechen" color="neutral" variant="outline" @click="open = false" />
          <UButton
            label="Hierhin verschieben"
            color="primary"
            icon="i-lucide-move"
            :loading="moving"
            @click="doMove"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
