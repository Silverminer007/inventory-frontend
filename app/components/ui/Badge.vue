<script setup lang="ts">
  type BadgeVariant = 'default' | 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'purple'

  const props = withDefaults(
    defineProps<{
      variant?: BadgeVariant
      size?: 'sm' | 'md'
    }>(),
    {
      variant: 'default',
      size: 'sm',
    },
  )

  const variantClass: Record<BadgeVariant, string> = {
    default: 'badge-default',
    blue: 'badge-blue',
    green: 'badge-green',
    amber: 'badge-amber',
    red: 'badge-red',
    slate: 'badge-slate',
    purple: 'badge-purple',
  }
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1 rounded-full font-medium',
      variantClass[props.variant],
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
    ]"
  >
    <slot />
  </span>
</template>

<style scoped>
  .badge-default {
    background: var(--badge-default-bg);
    color: var(--badge-default-text);
  }
  .badge-blue {
    background: var(--badge-blue-bg);
    color: var(--badge-blue-text);
  }
  .badge-green {
    background: var(--badge-green-bg);
    color: var(--badge-green-text);
  }
  .badge-amber {
    background: var(--badge-amber-bg);
    color: var(--badge-amber-text);
  }
  .badge-red {
    background: var(--badge-red-bg);
    color: var(--badge-red-text);
  }
  .badge-slate {
    background: var(--badge-slate-bg);
    color: var(--badge-slate-text);
  }
  .badge-purple {
    background: var(--badge-purple-bg);
    color: var(--badge-purple-text);
  }
</style>
