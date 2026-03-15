<template>
  <div class="flex items-center gap-3">
    <button
      role="switch"
      :aria-checked="modelValue"
      :class="cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        modelValue ? 'bg-primary' : 'bg-secondary'
      )"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <span
        :class="cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          modelValue ? 'translate-x-5' : 'translate-x-0'
        )"
      />
    </button>
    <div v-if="label || description">
      <p v-if="label" class="text-sm font-medium text-foreground">{{ label }}</p>
      <p v-if="description" class="text-xs text-muted-foreground">{{ description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{
  modelValue: boolean
  label?: string
  description?: string
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
