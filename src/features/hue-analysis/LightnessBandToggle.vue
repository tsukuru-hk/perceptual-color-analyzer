<template>
  <SegmentedControl
    :options="options"
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import { SegmentedControl } from '@/components/ui'
import type { SegmentOption } from '@/components/ui'

/** 明度帯フィルタの値 */
export type LightnessBand = 'all' | 'dark' | 'mid' | 'light'

const options: ReadonlyArray<SegmentOption<LightnessBand>> = [
  { value: 'all', label: 'All' },
  { value: 'dark', label: 'Dark' },
  { value: 'mid', label: 'Mid' },
  { value: 'light', label: 'Light' },
]

defineProps<{
  modelValue: LightnessBand
}>()

defineEmits<{
  'update:modelValue': [value: LightnessBand]
}>()
</script>
