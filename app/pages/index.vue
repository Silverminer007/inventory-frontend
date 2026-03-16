<script setup lang="ts">
const { getRoots } = useContainers()
const { data: roots, status, refresh } = await getRoots()

onMounted(() => refresh())

function containerIcon(type: string) {
  switch (type) {
    case 'ROOM': return 'i-lucide-door-open'
    case 'SHELF': return 'i-lucide-rows-3'
    case 'BOX': return 'i-lucide-box'
    default: return 'i-lucide-folder'
  }
}
</script>

<template>
  <div class="p-4 max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Raeume</h1>
      <UButton
        icon="i-lucide-plus"
        label="Raum"
        color="primary"
        to="/add?type=ROOM"
      />
    </div>

    <div v-if="status === 'pending'" class="space-y-3">
      <USkeleton v-for="i in 3" :key="i" class="h-20 rounded-xl" />
    </div>

    <div v-else-if="!roots?.length" class="text-center py-16">
      <UIcon name="i-lucide-warehouse" class="text-5xl text-muted mb-3" />
      <p class="text-muted text-lg">Noch keine Raeume vorhanden</p>
      <UButton
        label="Ersten Raum anlegen"
        color="primary"
        variant="soft"
        class="mt-4"
        to="/add?type=ROOM"
      />
    </div>

    <div v-else class="space-y-3">
      <NuxtLink
        v-for="room in roots"
        :key="room.id"
        :to="`/containers/${room.id}`"
        class="block p-4 rounded-xl border border-default bg-default hover:bg-elevated transition-colors shadow-sm"
      >
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <UIcon :name="containerIcon(room.containerType)" class="text-primary text-xl" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold truncate">{{ room.name }}</p>
            <p v-if="room.description" class="text-sm text-muted truncate">{{ room.description }}</p>
          </div>
          <div class="text-right text-sm text-muted">
            <p v-if="room.totalItemCount">{{ room.totalItemCount }} Gegenstaende</p>
            <p v-if="room.children?.length">{{ room.children.length }} Container</p>
          </div>
          <UIcon name="i-lucide-chevron-right" class="text-muted" />
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
