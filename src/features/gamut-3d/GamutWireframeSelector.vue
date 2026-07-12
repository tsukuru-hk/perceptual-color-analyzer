<template>
  <div class="absolute bottom-3 right-3 z-10">
    <SegmentedControl
      :options="options"
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { SegmentedControl } from '@/components/ui'
import type { SegmentOption } from '@/components/ui'
import type { WireframeGamut } from '@/domain/colorSpace'

defineProps<{
  modelValue: WireframeGamut
}>()

defineEmits<{
  'update:modelValue': [value: WireframeGamut]
}>()

const options: ReadonlyArray<SegmentOption<WireframeGamut>> = [
  { value: 'srgb', label: 'sRGB' },
  { value: 'display-p3', label: 'Display P3' },
  { value: 'rec2020', label: 'Rec.2020' },
  { value: 'lch-rec601', label: 'LCH (Rec.601)' },
]
</script>
