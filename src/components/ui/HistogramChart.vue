<template>
  <!-- デジタルヒストグラム: 隙間なし塗りつぶしバー。親要素の横幅に追従する -->
  <div>
    <p v-if="title" class="mb-2 text-sm font-medium text-muted-foreground">{{ title }}</p>
    <div class="border border-border">
    <svg
      :viewBox="`0 0 ${data.bins.length} ${svgHeight}`"
      preserveAspectRatio="none"
      width="100%"
      :style="{ height: height + 'px', display: 'block' }"
    >
      <rect
        v-for="(bin, i) in bars"
        :key="i"
        :x="i"
        :y="bin.y"
        width="1"
        :height="bin.h"
        :fill="bin.fill"
        :stroke="useGrayscaleFill ? '#c0c0c0' : 'none'"
        :stroke-width="useGrayscaleFill ? 0.3 : 0"
      />
    </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { HistogramData } from '@/infrastructure/histogramTypes'

const props = withDefaults(
  defineProps<{
    data: HistogramData
    title?: string
    fillColor?: string
    /** 各棒をビンの明度範囲に応じたグレースケール色で塗る */
    useGrayscaleFill?: boolean
    logScale?: boolean
    height?: number
  }>(),
  {
    title: undefined,
    fillColor: '#000000',
    useGrayscaleFill: false,
    logScale: false,
    height: 100,
  },
)

const svgHeight = 1000

const maxCount = computed(() => {
  let max = 0
  for (const bin of props.data.bins) {
    if (bin.count > max) max = bin.count
  }
  return max || 1
})

const bars = computed(() =>
  props.data.bins.map((bin) => {
    const raw = props.logScale ? Math.log1p(bin.count) : bin.count
    const max = props.logScale ? Math.log1p(maxCount.value) : maxCount.value
    const h = Math.round((raw / max) * svgHeight)
    const mid = (bin.rangeStart + bin.rangeEnd) / 2
    const domain = props.data.domain
    const t = domain[1] > domain[0] ? (mid - domain[0]) / (domain[1] - domain[0]) : 0
    const gray = Math.round(t * 255)
    const fill = props.useGrayscaleFill
      ? `rgb(${gray},${gray},${gray})`
      : props.fillColor
    return { y: svgHeight - h, h, fill }
  }),
)
</script>
