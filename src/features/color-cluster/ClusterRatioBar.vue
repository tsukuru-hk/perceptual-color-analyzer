<template>
  <!-- クラスタ占有率の横棒グラフ（左から占有率降順） -->
  <div class="space-y-1.5">
    <div class="flex h-6 w-full overflow-hidden rounded-md border border-border">
      <ColorCodeTooltip
        v-for="cluster in sorted"
        :key="cluster.id"
        :rgb="cluster.centroidRgb"
        class="h-full transition-all duration-500 ease-in-out"
        :style="{
          flex: '0 0 ' + cluster.ratio * 100 + '%',
          backgroundColor: rgbToFill(cluster.centroidRgb),
          minWidth: cluster.ratio > 0 ? '2px' : '0',
        }"
      />
    </div>
    <div class="flex flex-wrap gap-x-3 gap-y-1">
      <ColorCodeTooltip
        v-for="cluster in sorted"
        :key="cluster.id"
        :rgb="cluster.centroidRgb"
      >
        <div class="flex items-center gap-1 text-xs text-muted-foreground">
          <span
            class="inline-block h-2.5 w-2.5 rounded-sm border border-border"
            :style="{ backgroundColor: rgbToFill(cluster.centroidRgb) }"
          />
          <span class="tabular-nums">{{ (cluster.ratio * 100).toFixed(1) }}%</span>
        </div>
      </ColorCodeTooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ColorCluster } from '@/domain/colorCluster'
import { ColorCodeTooltip } from '@/components/ui'

const props = defineProps<{
  clusters: ReadonlyArray<ColorCluster>
}>()

const sorted = computed(() =>
  [...props.clusters].sort((a, b) => b.ratio - a.ratio),
)

function rgbToFill(rgb: { r: number; g: number; b: number }): string {
  return `rgb(${rgb.r},${rgb.g},${rgb.b})`
}
</script>
