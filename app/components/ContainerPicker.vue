<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useDatabase } from '~/composables/useDatabase'
  import { containerConfig } from '~/utils/containerUtils'
  import type { Container } from '~/types/inventory'
  import type { UUID } from '~/utils/uuid'

  const props = defineProps<{
    excludeId?: UUID
    title?: string
  }>()

  const emit = defineEmits<{
    select: [id: UUID]
    close: []
  }>()

  const db = useDatabase()
  const query = ref('')
  const allContainers = ref<Container[]>([])
  const expandedRooms = ref<Set<UUID>>(new Set())
  const expandedShelves = ref<Set<UUID>>(new Set())

  onMounted(async () => {
    allContainers.value = await db.getAllContainers()
    // Expand all by default
    for (const c of allContainers.value) {
      if (c.containerType === 'ROOM') expandedRooms.value.add(c.id)
      if (c.containerType === 'SHELF') expandedShelves.value.add(c.id)
    }
  })

  const filtered = computed(() => {
    const q = query.value.toLowerCase()
    if (!q) return allContainers.value
    return allContainers.value.filter((c) => c.name.toLowerCase().includes(q))
  })

  const rooms = computed(() => filtered.value.filter((c) => c.containerType === 'ROOM'))

  function shelvesOf(roomId: UUID): Container[] {
    return filtered.value.filter(
      (c) => c.containerType === 'SHELF' && c.parentContainerId === roomId,
    )
  }

  function boxesOf(shelfId: UUID): Container[] {
    return filtered.value.filter(
      (c) => c.containerType === 'BOX' && c.parentContainerId === shelfId,
    )
  }

  function isDisabled(id: UUID): boolean {
    return id === props.excludeId
  }

  function select(id: UUID) {
    if (isDisabled(id)) return
    emit('select', id)
  }
</script>

<template>
  <BottomSheet :title="title ?? 'Lagerort wählen'" @close="emit('close')">
    <!-- Search -->
    <div class="relative mb-3">
      <Icon
        icon="mdi:magnify"
        class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
        style="color: var(--color-text-muted)"
      />
      <input
        v-model="query"
        type="text"
        placeholder="Suchen…"
        class="search-input"
        style="
          padding-left: 2.25rem;
          padding-right: 0.875rem;
          padding-top: 0.5rem;
          padding-bottom: 0.5rem;
          font-size: 0.875rem;
        "
      />
    </div>

    <!-- Hierarchical list -->
    <div class="space-y-1 max-h-[50vh] overflow-y-auto">
      <template v-for="room in rooms" :key="room.id">
        <!-- Room -->
        <div>
          <div
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
            :class="isDisabled(room.id) ? 'opacity-40' : 'hover:opacity-80'"
          >
            <button
              class="flex items-center gap-3 flex-1 text-left min-w-0"
              :disabled="isDisabled(room.id)"
              @click="select(room.id)"
            >
              <Icon
                :icon="containerConfig.ROOM.icon"
                class="w-5 h-5 shrink-0"
                style="color: var(--color-accent)"
              />
              <span
                class="flex-1 font-medium text-sm truncate"
                style="color: var(--color-text-primary)"
                >{{ room.name }}</span
              >
            </button>
            <button
              class="p-1 shrink-0"
              @click="
                expandedRooms.has(room.id)
                  ? expandedRooms.delete(room.id)
                  : expandedRooms.add(room.id)
              "
            >
              <Icon
                :icon="expandedRooms.has(room.id) ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                class="w-4 h-4"
                style="color: var(--color-text-muted)"
              />
            </button>
          </div>

          <!-- Shelves -->
          <template v-if="expandedRooms.has(room.id)">
            <template v-for="shelf in shelvesOf(room.id)" :key="shelf.id">
              <div
                class="flex items-center gap-3 pl-8 pr-3 py-2 rounded-xl ml-2 transition-colors"
                :class="isDisabled(shelf.id) ? 'opacity-40' : 'hover:opacity-80'"
              >
                <button
                  class="flex items-center gap-3 flex-1 text-left min-w-0"
                  :disabled="isDisabled(shelf.id)"
                  @click="select(shelf.id)"
                >
                  <Icon
                    :icon="containerConfig.SHELF.icon"
                    class="w-4 h-4 shrink-0"
                    style="color: var(--color-accent)"
                  />
                  <span class="flex-1 text-sm truncate" style="color: var(--color-text-primary)">{{
                    shelf.name
                  }}</span>
                </button>
                <button
                  class="p-1 shrink-0"
                  @click="
                    expandedShelves.has(shelf.id)
                      ? expandedShelves.delete(shelf.id)
                      : expandedShelves.add(shelf.id)
                  "
                >
                  <Icon
                    :icon="expandedShelves.has(shelf.id) ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                    class="w-4 h-4"
                    style="color: var(--color-text-muted)"
                  />
                </button>
              </div>

              <!-- Boxes -->
              <template v-if="expandedShelves.has(shelf.id)">
                <button
                  v-for="box in boxesOf(shelf.id)"
                  :key="box.id"
                  class="w-full flex items-center gap-3 pl-14 pr-3 py-2 rounded-xl text-left ml-2 transition-colors"
                  :class="isDisabled(box.id) ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-80'"
                  @click="isDisabled(box.id) ? undefined : select(box.id)"
                >
                  <Icon
                    :icon="containerConfig.BOX.icon"
                    class="w-4 h-4 shrink-0"
                    style="color: var(--color-accent)"
                  />
                  <span class="text-sm" style="color: var(--color-text-primary)">{{
                    box.name
                  }}</span>
                </button>
              </template>
            </template>
          </template>
        </div>
      </template>

      <div
        v-if="rooms.length === 0"
        class="py-8 text-center text-sm"
        style="color: var(--color-text-muted)"
      >
        Keine Lagerorte gefunden
      </div>
    </div>
  </BottomSheet>
</template>
