<template>
  <div
    :class="cn(
      'border border-border shadow-sm',
      sizeClass,
      rounded ? 'rounded-full' : 'rounded-lg',
      $attrs.class as string
    )"
    :style="{ backgroundColor: color }"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  color: string
  size?: 'sm' | 'md' | 'lg'
  rounded?: boolean
}>(), {
  size: 'md',
  rounded: false,
})

const sizeClass = computed(() => {
  const map = { sm: 'h-6 w-6', md: 'h-10 w-10', lg: 'h-16 w-16' }
  return map[props.size]
})
</script>
