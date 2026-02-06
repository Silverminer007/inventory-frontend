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
const { create: createItem, update: updateItem } = useItems()
const { apiFetch } = useApi()

// Container form
const containerForm = reactive<ContainerDTO>({
  name: '',
  description: '',
  containerType: typeParam.value !== 'ITEM' ? typeParam.value : 'ROOM',
  locationType: 'PERMANENT',
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
const containers = ref<ContainerDTO[]>([])

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

const locationTypeOptions = [
  { label: 'Permanent', value: 'PERMANENT' },
  { label: 'Temporaer', value: 'TEMPORARY' }
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
        await createItem(itemForm)
        toast.add({ title: 'Erstellt', description: `${itemForm.name} wurde erstellt.`, color: 'success' })
      }
      if (itemForm.containerId) {
        navigateTo(`/containers/${itemForm.containerId}`)
      } else {
        navigateTo('/')
      }
    } else {
      const result = await createContainer(containerForm)
      toast.add({ title: 'Erstellt', description: `${containerForm.name} wurde erstellt.`, color: 'success' })
      navigateTo(`/containers/${result.id}`)
    }
  } catch (e: any) {
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

      <UFormField label="Barcode">
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

    <!-- Container Form -->
    <form v-else class="space-y-4" @submit.prevent="save">
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

      <UFormField label="Standort-Typ">
        <USelectMenu
          v-model="containerForm.locationType"
          :items="locationTypeOptions"
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
