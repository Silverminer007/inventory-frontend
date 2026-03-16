<script setup lang="ts">
import type { ContainerDTO, ItemDTO } from '~/types'

const route = useRoute()
const toast = useToast()

const editId = computed(() => route.query.edit as string | undefined)
const typeParam = computed(() => (route.query.type as string) || 'ITEM')
const parentParam = computed(() => route.query.parent as string | undefined)
const containerParam = computed(() => route.query.container as string | undefined)

const isItem = computed(() => typeParam.value === 'ITEM' || !!editId.value)
const isEditing = computed(() => !!editId.value)

const { create: createContainer, update: updateContainer, fetchAllFlat } = useContainers()
const { create: createItem, update: updateItem, suggestTags } = useItems()
const { apiFetch } = useApi()
const { uploadImage } = useImages()

// Container form
const containerForm = reactive<ContainerDTO>({
  name: '',
  description: '',
  containerType: typeParam.value !== 'ITEM' ? typeParam.value : 'ROOM',
  position: '',
  parentContainerId: parentParam.value ? Number(parentParam.value) : null
})

// Item form
const itemForm = reactive<ItemDTO>({
  name: '',
  description: '',
  quantity: 1,
  position: '',
  barcode: '',
  tags: [],
  containerId: containerParam.value ? Number(containerParam.value) : null
})

const tagInput = ref('')
const saving = ref(false)
const suggestedTags = ref<string[]>([])

let suggestDebounce: ReturnType<typeof setTimeout>
watch(() => itemForm.name, (name) => {
  clearTimeout(suggestDebounce)
  if (!name?.trim()) {
    suggestedTags.value = []
    return
  }
  suggestDebounce = setTimeout(async () => {
    suggestedTags.value = ['test']//await suggestTags(name.trim())
    await suggestTags('test')
  }, 400)
})

function addSuggestedTag(tag: string) {
  if (!itemForm.tags?.includes(tag)) {
    itemForm.tags = [...(itemForm.tags || []), tag]
  }
}
const containers = ref<ContainerDTO[]>([])
const pendingImages = ref<File[]>([])
const imageFileInput = ref<HTMLInputElement | null>(null)

function triggerImageSelect() {
  imageFileInput.value?.click()
}

function handleImageSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files) return
  pendingImages.value.push(...Array.from(files))
  input.value = ''
}

function removeImage(index: number) {
  pendingImages.value.splice(index, 1)
}

function getPreviewUrl(file: File) {
  return URL.createObjectURL(file)
}

async function loadContainers() {
  containers.value = await fetchAllFlat()
}

onMounted(async () => {
  await loadContainers()
  if (editId.value) {
    try {
      const item = await apiFetch<ItemDTO>(`/api/v1/items/${editId.value}`)
      Object.assign(itemForm, item)
    } catch {
      toast.add({ title: 'Fehler', description: 'Gegenstand nicht gefunden', color: 'error' })
    }
  }
})

function addTag() {
  const tag = tagInput.value.trim()
  if (tag && !itemForm.tags?.includes(tag)) {
    itemForm.tags = [...(itemForm.tags || []), tag]
  }
  tagInput.value = ''
}

function removeTag(tag: string) {
  itemForm.tags = itemForm.tags?.filter(t => t !== tag) || []
}

const containerTypeOptions = [
  { label: 'Raum', value: 'ROOM' },
  { label: 'Regal', value: 'SHELF' },
  { label: 'Kiste', value: 'BOX' }
]

const parentOptions = computed(() => {
  return [
    { label: '-- Kein Eltern-Container (Root) --', value: null as number | null },
    ...containers.value.map(c => ({
      label: `${c.locationPath || c.name} (${c.containerType})`,
      value: c.id as number | null
    }))
  ]
})

const containerOptions = computed(() => {
  return [
    { label: '-- Kein Container --', value: null as number | null },
    ...containers.value.map(c => ({
      label: `${c.locationPath || c.name} (${c.containerType})`,
      value: c.id as number | null
    }))
  ]
})

async function save() {
  saving.value = true
  try {
    if (isItem.value || isEditing.value) {
      if (isEditing.value && editId.value) {
        await updateItem(Number(editId.value), itemForm)
        toast.add({ title: 'Gespeichert', description: `${itemForm.name} wurde aktualisiert.`, color: 'success' })
      } else {
        const created = await createItem(itemForm)
        if (pendingImages.value.length && created.id) {
          for (let i = 0; i < pendingImages.value.length; i++) {
            await uploadImage('items', created.id, pendingImages.value[i], i === 0)
          }
        }
        toast.add({ title: 'Erstellt', description: `${itemForm.name} wurde erstellt.`, color: 'success' })
      }
      if (itemForm.containerId) {
        navigateTo(`/containers/${itemForm.containerId}`)
      } else {
        navigateTo('/')
      }
    } else {
      const result = await createContainer(containerForm)
      if (pendingImages.value.length && result.id) {
        for (let i = 0; i < pendingImages.value.length; i++) {
          await uploadImage('containers', result.id, pendingImages.value[i], i === 0)
        }
      }
      toast.add({ title: 'Erstellt', description: `${containerForm.name} wurde erstellt.`, color: 'success' })
      navigateTo(`/containers/${result.id}`)
    }
  } catch (e: any) {
    console.log(e)
    toast.add({ title: 'Fehler', description: e?.data?.message || 'Speichern fehlgeschlagen', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="p-4 max-w-lg mx-auto">
    <div class="flex items-center gap-3 mb-6">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="$router.back()" />
      <h1 class="text-2xl font-bold">
        {{ isEditing ? 'Bearbeiten' : (isItem ? 'Neuer Gegenstand' : 'Neuer Container') }}
      </h1>
    </div>

    <!-- Item Form -->
    <form v-if="isItem || isEditing" class="space-y-4" @submit.prevent="save">
      <UFormField label="Name" required>
        <UInput v-model="itemForm.name" placeholder="z.B. Hammer, Zelt, Kabel..." class="w-full" />
      </UFormField>

      <UFormField label="Beschreibung">
        <UTextarea v-model="itemForm.description" placeholder="Optionale Beschreibung..." class="w-full" />
      </UFormField>

      <UFormField label="Anzahl" required>
        <UInput v-model.number="itemForm.quantity" type="number" :min="1" class="w-full" />
      </UFormField>

      <UFormField label="Container">
        <USelectMenu
          v-model="itemForm.containerId"
          :items="containerOptions"
          value-key="value"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Position">
        <UInput v-model="itemForm.position" placeholder="z.B. oben links, Fach 3..." class="w-full" />
      </UFormField>

      <UFormField label="Barcode" class="hidden">
        <UInput v-model="itemForm.barcode" placeholder="Optional: Barcode eingeben" class="w-full" />
      </UFormField>

      <UFormField label="Tags">
        <div class="flex flex-wrap gap-1.5 mb-2">
          <UBadge
            v-for="tag in itemForm.tags"
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
        <div v-if="suggestedTags.length" class="flex flex-wrap gap-1.5 mt-2">
          <span class="text-xs text-muted self-center">Vorschlaege:</span>
          <UBadge
            v-for="tag in suggestedTags"
            :key="tag"
            :label="tag"
            color="neutral"
            variant="subtle"
            class="cursor-pointer"
            @click="addSuggestedTag(tag)"
          >
            <template #trailing>
              <UIcon name="i-lucide-plus" class="text-xs" />
            </template>
          </UBadge>
        </div>
      </UFormField>

      <!-- Image upload during creation -->
      <UFormField v-if="!isEditing" label="Bilder">
        <div v-if="pendingImages.length" class="grid grid-cols-3 gap-2 mb-2">
          <div
            v-for="(file, index) in pendingImages"
            :key="index"
            class="group relative aspect-square rounded-lg overflow-hidden border border-default"
          >
            <img :src="getPreviewUrl(file)" :alt="file.name" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-end p-1 opacity-0 group-hover:opacity-100">
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="solid"
                @click="removeImage(index)"
              />
            </div>
          </div>
        </div>
        <UButton
          icon="i-lucide-camera"
          label="Bild hinzufuegen"
          color="primary"
          variant="soft"
          block
          @click="triggerImageSelect"
        />
        <input
          ref="imageFileInput"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          class="hidden"
          @change="handleImageSelect"
        >
      </UFormField>

      <UButton
        type="submit"
        :label="isEditing ? 'Speichern' : 'Erstellen'"
        color="primary"
        block
        size="lg"
        :loading="saving"
        :disabled="!itemForm.name.trim()"
      />
    </form>

    <!-- Item Images (only when editing) -->
    <ImageGallery
      v-if="isEditing && editId"
      entity-type="items"
      :entity-id="Number(editId)"
      class="mt-6"
    />

    <!-- Container Form -->
    <form v-if="!(isItem || isEditing)" class="space-y-4" @submit.prevent="save">
      <UFormField label="Name" required>
        <UInput v-model="containerForm.name" placeholder="z.B. Keller, Regal A, Kiste Werkzeug..." class="w-full" />
      </UFormField>

      <UFormField label="Beschreibung">
        <UTextarea v-model="containerForm.description" placeholder="Optionale Beschreibung..." class="w-full" />
      </UFormField>

      <UFormField label="Typ">
        <USelectMenu
          v-model="containerForm.containerType"
          :items="containerTypeOptions"
          value-key="value"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Uebergeordneter Container">
        <USelectMenu
          v-model="containerForm.parentContainerId"
          :items="parentOptions"
          value-key="value"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Position">
        <UInput v-model="containerForm.position" placeholder="z.B. links, Ecke hinten..." class="w-full" />
      </UFormField>

      <!-- Image upload during creation -->
      <UFormField label="Bilder">
        <div v-if="pendingImages.length" class="grid grid-cols-3 gap-2 mb-2">
          <div
            v-for="(file, index) in pendingImages"
            :key="index"
            class="group relative aspect-square rounded-lg overflow-hidden border border-default"
          >
            <img :src="getPreviewUrl(file)" :alt="file.name" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-end p-1 opacity-0 group-hover:opacity-100">
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="solid"
                @click="removeImage(index)"
              />
            </div>
          </div>
        </div>
        <UButton
          icon="i-lucide-camera"
          label="Bild hinzufuegen"
          color="primary"
          variant="soft"
          block
          @click="triggerImageSelect"
        />
        <input
          ref="imageFileInput"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          class="hidden"
          @change="handleImageSelect"
        >
      </UFormField>

      <UButton
        type="submit"
        label="Erstellen"
        color="primary"
        block
        size="lg"
        :loading="saving"
        :disabled="!containerForm.name.trim()"
      />
    </form>
  </div>
</template>
