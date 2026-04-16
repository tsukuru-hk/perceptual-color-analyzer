<template>
  <!-- クラスタ凡例: 支配的な順に色スウォッチ・割合を表示 -->
  <div class="flex flex-wrap gap-3">
    <div
      v-for="cluster in clusters"
      :key="cluster.id"
      class="flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <span
        class="inline-block h-3 w-3 rounded-full border border-border"
        :style="{ backgroundColor: rgbToFill(cluster.centroidRgb) }"
      />
      <span>{{ (cluster.ratio * 100).toFixed(1) }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColorCluster } from '@/domain/colorCluster'

defineProps<{
  clusters: ReadonlyArray<ColorCluster>
}>()

function rgbToFill(rgb: { r: number; g: number; b: number }): string {
  return `rgb(${rgb.r},${rgb.g},${rgb.b})`
}
</script>
