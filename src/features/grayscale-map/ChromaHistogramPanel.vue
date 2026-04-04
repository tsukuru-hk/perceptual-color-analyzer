<template>
  <HistogramChart v-if="histogramData" :data="histogramData" :use-grayscale-fill="true" :log-scale="logScale" />
</template>

<script setup lang="ts">
import type { HistogramData } from '@/infrastructure/histogramTypes'
import HistogramChart from '@/components/ui/HistogramChart.vue'

defineProps<{
  histogramData: HistogramData | null
  logScale?: boolean
}>()
</script>
