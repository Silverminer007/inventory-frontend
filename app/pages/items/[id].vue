<script setup lang="ts">
const route = useRoute()
const id = computed(() => route.params.id as string)
const toast = useToast()

const { getById, update, remove: removeItem } = useItems()

const { data: item, status, refresh } = await getById(id.value)

const showMoveModal = ref(false)
const showDeleteConfirm = ref(false)

const tagInput = ref('')

function addTag() {
  const tag = tagInput.value.trim()
  if (!tag || !item.value) return
  if (item.value.tags?.includes(tag)) {
    tagInput.value = ''
    return
  }
  const updatedTags = [...(item.value.tags || []), tag]
  saveTagsUpdate(updatedTags)
  tagInput.value = ''
}

function removeTag(tag: string) {
  if (!item.value) return
  const updatedTags = (item.value.tags || []).filter(t => t !== tag)
  saveTagsUpdate(updatedTags)
}

async function saveTagsUpdate(tags: string[]) {
  if (!item.value?.id) return
  try {
    await update(item.value.id, { ...item.value, tags })
    await refresh()
  } catch (e: any) {
    toast.add({ title: 'Fehler', description: e?.data?.message || 'Tags konnten nicht gespeichert werden', color: 'error' })
  }
}

async function handleDelete() {
  if (!item.value?.id) return
  try {
    await removeItem(item.value.id)
    toast.add({ title: 'Geloescht', description: `${item.value.name} wurde geloescht.`, color: 'success' })
    if (item.value.containerId) {
      navigateTo(`/containers/${item.value.containerId}`)
    } else {
      navigateTo('/')
    }
  } catch (e: any) {
    toast.add({ title: 'Fehler', description: e?.data?.message || 'Loeschen fehlgeschlagen', color: 'error' })
  }
  showDeleteConfirm.value = false
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '–'
  return new Date(dateStr).toLocaleString('de-DE')
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

    <template v-else-if="item">
      <!-- Breadcrumbs -->
      <div class="flex items-center gap-1 text-sm text-muted mb-4 flex-wrap">
        <NuxtLink to="/" class="hover:text-default transition-colors">
          <UIcon name="i-lucide-home" class="text-base" />
        </NuxtLink>
        <template v-if="item.container">
          <UIcon name="i-lucide-chevron-right" class="text-xs" />
          <NuxtLink
            :to="`/containers/${item.container.id}`"
            class="hover:text-default transition-colors"
          >
            {{ item.container.name }}
          </NuxtLink>
        </template>
        <UIcon name="i-lucide-chevron-right" class="text-xs" />
        <span class="text-default font-medium">{{ item.name }}</span>
      </div>

      <!-- Header -->
      <div class="flex items-start justify-between gap-3 mb-6">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/30">
            <UIcon name="i-lucide-package" class="text-amber-600 text-2xl" />
          </div>
          <div>
            <h1 class="text-2xl font-bold">{{ item.name }}</h1>
            <p v-if="item.description" class="text-muted">{{ item.description }}</p>
            <div class="flex gap-2 mt-1">
              <UBadge
                v-if="item.quantity > 1"
                :label="`${item.quantity}x`"
                color="neutral"
                variant="subtle"
                size="sm"
              />
              <UBadge
                v-if="item.position"
                :label="`Position: ${item.position}`"
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
              { label: 'Bearbeiten', icon: 'i-lucide-pencil', onSelect: () => navigateTo(`/add?edit=${item!.id}`) },
              { label: 'Verschieben', icon: 'i-lucide-move', onSelect: () => showMoveModal = true }
            ],
            [
              { label: 'Loeschen', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => showDeleteConfirm = true }
            ]
          ]"
        >
          <UButton icon="i-lucide-more-vertical" color="neutral" variant="ghost" />
        </UDropdownMenu>
      </div>

      <!-- Images -->
      <ImageGallery
        v-if="item.id"
        entity-type="items"
        :entity-id="item.id"
      />

      <!-- Tags -->
      <div class="mb-6">
        <h2 class="font-semibold text-lg mb-3">Tags</h2>
        <div class="flex flex-wrap gap-1.5 mb-2">
          <UBadge
            v-for="tag in item.tags"
            :key="tag"
            :label="tag"
            color="primary"
            variant="subtle"
            class="cursor-pointer"
            @click="removeTag(tag)"
          >
            <template #trailing>
              <UIcon name="i-lucide-x" class="text-xs" />
            </template>
          </UBadge>
          <span v-if="!item.tags?.length" class="text-sm text-muted">Keine Tags</span>
        </div>
        <div class="flex gap-2">
          <UInput
            v-model="tagInput"
            placeholder="Tag hinzufuegen..."
            class="flex-1"
            @keydown.enter.prevent="addTag"
          />
          <UButton label="+" color="primary" variant="soft" @click="addTag" />
        </div>
      </div>

      <!-- Details -->
      <div class="mb-6">
        <h2 class="font-semibold text-lg mb-3">Details</h2>
        <div class="space-y-2 text-sm">
          <div v-if="item.position" class="flex justify-between">
            <span class="text-muted">Position</span>
            <span>{{ item.position }}</span>
          </div>
          <div v-if="item.barcode" class="flex justify-between">
            <span class="text-muted">Barcode</span>
            <span>{{ item.barcode }}</span>
          </div>
          <div v-if="item.locationPath" class="flex justify-between">
            <span class="text-muted">Standort</span>
            <span>{{ item.locationPath }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">Erstellt</span>
            <span>{{ formatDate(item.createdAt) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">Zuletzt geaendert</span>
            <span>{{ formatDate(item.lastModified) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Not found -->
    <div v-else class="text-center py-16">
      <UIcon name="i-lucide-package-x" class="text-5xl text-muted mb-3" />
      <p class="text-muted text-lg">Gegenstand nicht gefunden</p>
    </div>

    <!-- Move Item Modal -->
    <MoveModal
      v-if="item"
      v-model:open="showMoveModal"
      :source-id="item.id"
      source-type="item"
      @moved="refresh"
    />

    <!-- Delete Confirmation -->
    <UModal v-model:open="showDeleteConfirm">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-2">Gegenstand loeschen?</h3>
          <p class="text-muted mb-4">
            <strong>{{ item?.name }}</strong> wird unwiderruflich geloescht.
          </p>
          <div class="flex justify-end gap-2">
            <UButton label="Abbrechen" color="neutral" variant="outline" @click="showDeleteConfirm = false" />
            <UButton label="Loeschen" color="error" @click="handleDelete" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
