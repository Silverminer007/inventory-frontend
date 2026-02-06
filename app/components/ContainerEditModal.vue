<script setup lang="ts">
import type { ContainerDTO } from '~/types'

const props = defineProps<{
  container: ContainerDTO
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { update: updateContainer } = useContainers()

const form = reactive<ContainerDTO>({
  name: '',
  description: '',
  containerType: 'ROOM',
  locationType: 'PERMANENT',
  position: '',
  parentContainerId: null,
  version: 0
})

const saving = ref(false)

watch(open, (val) => {
  if (val) {
    Object.assign(form, {
      name: props.container.name,
      description: props.container.description || '',
      containerType: props.container.containerType,
      locationType: props.container.locationType || 'PERMANENT',
      position: props.container.position || '',
      parentContainerId: props.container.parentContainerId,
      version: props.container.version
    })
  }
})

const locationTypeOptions = [
  { label: 'Permanent', value: 'PERMANENT' },
  { label: 'Temporaer', value: 'TEMPORARY' }
]

async function save() {
  if (!props.container.id) return
  saving.value = true
  try {
    await updateContainer(props.container.id, form)
    toast.add({ title: 'Gespeichert', description: `${form.name} wurde aktualisiert.`, color: 'success' })
    open.value = false
    emit('saved')
  } catch (e: any) {
    toast.add({ title: 'Fehler', description: e?.data?.message || 'Speichern fehlgeschlagen', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4">Container bearbeiten</h3>
        <form class="space-y-4" @submit.prevent="save">
          <UFormField label="Name" required>
            <UInput v-model="form.name" class="w-full" />
          </UFormField>

          <UFormField label="Beschreibung">
            <UTextarea v-model="form.description" class="w-full" />
          </UFormField>

          <UFormField label="Standort-Typ">
            <USelectMenu
              v-model="form.locationType"
              :items="locationTypeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Position">
            <UInput v-model="form.position" class="w-full" />
          </UFormField>

          <div class="flex justify-end gap-2 pt-2">
            <UButton label="Abbrechen" color="neutral" variant="outline" @click="open = false" />
            <UButton
              type="submit"
              label="Speichern"
              color="primary"
              :loading="saving"
              :disabled="!form.name.trim()"
            />
          </div>
        </form>
      </div>
    </template>
  </UModal>
</template>
