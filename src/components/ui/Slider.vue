<template>
  <div class="space-y-2">
    <div v-if="label" class="flex items-center justify-between">
      <label class="text-sm font-medium text-foreground">{{ label }}</label>
      <span class="text-sm tabular-nums text-muted-foreground">{{ modelValue }}</span>
    </div>
    <SliderRoot
      :model-value="[modelValue]"
      :min="min"
      :max="max"
      :step="step"
      class="relative flex w-full touch-none select-none items-center"
      @update:model-value="(val: number[] | undefined) => { if (val) $emit('update:modelValue', val[0]!) }"
    >
      <SliderTrack class="relative h-2 w-full grow rounded-full bg-secondary">
        <SliderRange class="absolute h-full rounded-full bg-primary" />
      </SliderTrack>
      <SliderThumb
        class="block h-5 w-5 rounded-full border-2 border-primary bg-card shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </SliderRoot>
  </div>
</template>

<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'radix-vue'

withDefaults(defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
  label?: string
}>(), {
  min: 0,
  max: 100,
  step: 1,
})

defineEmits<{
  'update:modelValue': [value: number]
}>()
</script>
