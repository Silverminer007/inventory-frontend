<script setup lang="ts">
import type { ItemDTO } from '~/types'

const route = useRoute()
const id = computed(() => route.params.id as string)
const toast = useToast()

const { getById, getChildren, remove: removeContainer } = useContainers()
const { apiFetch } = useApi()

const { data: container, status, refresh } = await getById(id)
const { data: children, refresh: refreshChildren } = await getChildren(id)

const items = ref<ItemDTO[]>([])
const loadingItems = ref(true)

async function loadItems() {
  loadingItems.value = true
  try {
    const allItems = await apiFetch<ItemDTO[]>('/api/v1/items')
    items.value = allItems.filter(item => item.containerId === Number(id.value))
  } finally {
    loadingItems.value = false
  }
}

await loadItems()

watch(id, () => loadItems())

function containerIcon(type: string) {
  switch (type) {
    case 'ROOM': return 'i-lucide-door-open'
    case 'SHELF': return 'i-lucide-rows-3'
    case 'BOX': return 'i-lucide-box'
    default: return 'i-lucide-folder'
  }
}

function childContainerType(parentType: string) {
  switch (parentType) {
    case 'ROOM': return 'SHELF'
    case 'SHELF': return 'BOX'
    default: return 'BOX'
  }
}

const showEditModal = ref(false)
const showMoveModal = ref(false)
const showDeleteConfirm = ref(false)
const showMoveItemModal = ref(false)
const movingItemId = ref<number | null>(null)

async function handleDelete() {
  if (!container.value?.id) return
  try {
    await removeContainer(container.value.id)
    toast.add({ title: 'Geloescht', description: `${container.value.name} wurde geloescht.`, color: 'success' })
    if (container.value.parentContainerId) {
      navigateTo(`/containers/${container.value.parentContainerId}`)
    } else {
      navigateTo('/')
    }
  } catch (e: any) {
    toast.add({ title: 'Fehler', description: e?.data?.message || 'Loeschen fehlgeschlagen', color: 'error' })
  }
  showDeleteConfirm.value = false
}

function openMoveItem(itemId: number) {
  movingItemId.value = itemId
  showMoveItemModal.value = true
}

async function refreshAll() {
  await refresh()
  await refreshChildren()
  await loadItems()
}
</script>

<template>
  <div class="p-4 max-w-3xl mx-auto">
    <!-- Loading -->
    <div v-if="status === 'pending'" class="space-y-4">
      <USkeleton class="h-8 w-48" />
      <USkeleton class="h-20 rounded-xl" />
      <USkeleton class="h-20 rounded-xl" />
    </div>

    <template v-else-if="container">
      <!-- Breadcrumbs -->
      <div class="flex items-center gap-1 text-sm text-muted mb-4 flex-wrap">
        <NuxtLink to="/" class="hover:text-default transition-colors">
          <UIcon name="i-lucide-home" class="text-base" />
        </NuxtLink>
        <template v-if="container.parent">
          <UIcon name="i-lucide-chevron-right" class="text-xs" />
          <NuxtLink
            :to="`/containers/${container.parent.id}`"
            class="hover:text-default transition-colors"
          >
            {{ container.parent.name }}
          </NuxtLink>
        </template>
        <UIcon name="i-lucide-chevron-right" class="text-xs" />
        <span class="text-default font-medium">{{ container.name }}</span>
      </div>

      <!-- Header -->
      <div class="flex items-start justify-between gap-3 mb-6">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
            <UIcon :name="containerIcon(container.containerType)" class="text-primary text-2xl" />
          </div>
          <div>
            <h1 class="text-2xl font-bold">{{ container.name }}</h1>
            <p v-if="container.description" class="text-muted">{{ container.description }}</p>
            <div class="flex gap-2 mt-1">
              <UBadge :label="container.containerType" color="neutral" variant="subtle" size="sm" />
              <UBadge
                v-if="container.locationType === 'TEMPORARY'"
                label="Temporaer"
                color="amber"
                variant="subtle"
                size="sm"
              />
              <UBadge
                v-if="container.position"
                :label="`Position: ${container.position}`"
                color="neutral"
                variant="outline"
                size="sm"
              />
            </div>
          </div>
        </div>
        <UDropdownMenu
          :items="[
            [
              { label: 'Bearbeiten', icon: 'i-lucide-pencil', click: () => showEditModal = true },
              { label: 'Verschieben', icon: 'i-lucide-move', click: () => showMoveModal = true }
            ],
            [
              { label: 'Loeschen', icon: 'i-lucide-trash-2', color: 'error' as const, click: () => showDeleteConfirm = true }
            ]
          ]"
        >
          <UButton icon="i-lucide-more-vertical" color="neutral" variant="ghost" />
        </UDropdownMenu>
      </div>

      <!-- Images -->
      <ImageGallery
        v-if="container.id"
        entity-type="containers"
        :entity-id="container.id"
      />

      <!-- Child containers -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-lg">Container</h2>
          <UButton
            icon="i-lucide-plus"
            :label="childContainerType(container.containerType)"
            size="sm"
            color="primary"
            variant="soft"
            :to="`/add?type=${childContainerType(container.containerType)}&parent=${container.id}`"
          />
        </div>

        <div v-if="!children?.length" class="text-center py-8 text-muted">
          <UIcon name="i-lucide-folder-open" class="text-3xl mb-2" />
          <p>Keine Untercontainer</p>
        </div>

        <div v-else class="space-y-2">
          <NuxtLink
            v-for="child in children"
            :key="child.id"
            :to="`/containers/${child.id}`"
            class="block p-3 rounded-xl border border-default bg-default hover:bg-elevated transition-colors shadow-sm"
          >
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
                <UIcon :name="containerIcon(child.containerType)" class="text-primary text-lg" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ child.name }}</p>
                <p v-if="child.description" class="text-xs text-muted truncate">{{ child.description }}</p>
              </div>
              <UBadge
                v-if="child.locationType === 'TEMPORARY'"
                label="Temp"
                color="amber"
                variant="subtle"
                size="xs"
              />
              <span v-if="child.totalItemCount" class="text-xs text-muted">{{ child.totalItemCount }}</span>
              <UIcon name="i-lucide-chevron-right" class="text-muted" />
            </div>
          </NuxtLink>
        </div>
      </div>

      <!-- Items -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-lg">Gegenstaende</h2>
          <UButton
            icon="i-lucide-plus"
            label="Gegenstand"
            size="sm"
            color="primary"
            variant="soft"
            :to="`/add?type=ITEM&container=${container.id}`"
          />
        </div>

        <div v-if="loadingItems" class="space-y-2">
          <USkeleton v-for="i in 2" :key="i" class="h-16 rounded-xl" />
        </div>

        <div v-else-if="!items.length" class="text-center py-8 text-muted">
          <UIcon name="i-lucide-package" class="text-3xl mb-2" />
          <p>Keine Gegenstaende</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="item in items"
            :key="item.id"
            class="p-3 rounded-xl border border-default bg-default shadow-sm"
          >
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <UIcon name="i-lucide-package" class="text-amber-600 text-lg" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ item.name }}</p>
                <p v-if="item.description" class="text-xs text-muted truncate">{{ item.description }}</p>
                <div v-if="item.tags?.length" class="flex flex-wrap gap-1 mt-1">
                  <UBadge
                    v-for="tag in item.tags"
                    :key="tag"
                    :label="tag"
                    color="primary"
                    variant="subtle"
                    size="xs"
                  />
                </div>
              </div>
              <div class="flex items-center gap-2">
                <UBadge v-if="item.quantity > 1" :label="`${item.quantity}x`" color="neutral" variant="subtle" size="sm" />
                <UDropdownMenu
                  :items="[
                    [
                      { label: 'Bearbeiten', icon: 'i-lucide-pencil', click: () => navigateTo(`/add?edit=${item.id}`) },
                      { label: 'Verschieben', icon: 'i-lucide-move', click: () => openMoveItem(item.id!) }
                    ],
                    [
                      { label: 'Loeschen', icon: 'i-lucide-trash-2', color: 'error' as const, click: async () => {
                        try {
                          await useItems().remove(item.id!)
                          toast.add({ title: 'Geloescht', color: 'success' })
                          await loadItems()
                        } catch (e: any) {
                          toast.add({ title: 'Fehler', description: e?.data?.message || 'Fehler', color: 'error' })
                        }
                      }}
                    ]
                  ]"
                >
                  <UButton icon="i-lucide-more-vertical" color="neutral" variant="ghost" size="sm" />
                </UDropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Edit Container Modal -->
    <ContainerEditModal
      v-if="container"
      v-model:open="showEditModal"
      :container="container"
      @saved="refreshAll"
    />

    <!-- Move Container Modal -->
    <MoveModal
      v-model:open="showMoveModal"
      :source-id="container?.id"
      source-type="container"
      @moved="refreshAll"
    />

    <!-- Move Item Modal -->
    <MoveModal
      v-model:open="showMoveItemModal"
      :source-id="movingItemId"
      source-type="item"
      @moved="refreshAll"
    />

    <!-- Delete Confirmation -->
    <UModal v-model:open="showDeleteConfirm">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-2">Container loeschen?</h3>
          <p class="text-muted mb-1">
            <strong>{{ container?.name }}</strong> wird unwiderruflich geloescht.
          </p>
          <p v-if="children?.length || items.length" class="text-sm text-amber-600 mb-4">
            Achtung: Dieser Container enthaelt {{ children?.length || 0 }} Untercontainer und {{ items.length }} Gegenstaende. Alle Inhalte werden ebenfalls geloescht!
          </p>
          <p v-else class="text-sm text-muted mb-4">Dieser Container ist leer.</p>
          <div class="flex justify-end gap-2">
            <UButton label="Abbrechen" color="neutral" variant="outline" @click="showDeleteConfirm = false" />
            <UButton label="Loeschen" color="error" @click="handleDelete" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
