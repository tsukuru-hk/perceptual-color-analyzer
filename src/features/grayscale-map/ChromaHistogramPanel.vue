<template>
  <HistogramChart v-if="histogramData" :data="histogramData" :log-scale="logScale" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { generateChromaHistogramUseCase } from '@/application/useCase/generateChromaHistogramUseCase'
import type { HistogramData } from '@/infrastructure/histogramTypes'
import HistogramChart from '@/components/ui/HistogramChart.vue'

const props = defineProps<{
  imageData: ImageData
  logScale?: boolean
}>()

const histogramData = ref<HistogramData | null>(null)

watch(
  () => props.imageData,
  (newData) => {
    const result = generateChromaHistogramUseCase(newData)
    histogramData.value = result.isSuccess() ? result.value : null
  },
  { immediate: true },
)
</script>
