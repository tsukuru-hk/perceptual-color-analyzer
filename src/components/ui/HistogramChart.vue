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
import { formatHex, clampChroma, converter } from 'culori'
import type { HistogramData } from '@/infrastructure/histogramTypes'

const props = withDefaults(
  defineProps<{
    data: HistogramData
    title?: string
    fillColor?: string
    /** 各棒をビンの明度範囲に応じたグレースケール色で塗る */
    useGrayscaleFill?: boolean
    /** 各棒をビンの彩度範囲に応じた OKLCH 色（グレー→最大彩度）で塗る */
    useChromaFill?: boolean
    logScale?: boolean
    height?: number
  }>(),
  {
    title: undefined,
    fillColor: '#000000',
    useGrayscaleFill: false,
    useChromaFill: false,
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

/**
 * OKLCH L → sRGB グレー値の LUT（256 段階）。
 * L をそのまま sRGB 値にマッピングするとガンマが二重適用されるため、
 * OKLCH(L, 0, 0) → sRGB の逆変換で知覚的に正確なグレー値を得る。
 */
const lightnessToSrgbLut = (() => {
  const toRgb = converter('rgb')
  const lut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    const l = i / 255
    const srgb = toRgb({ mode: 'oklch', l, c: 0, h: 0 })
    lut[i] = Math.round(Math.max(0, Math.min(1, srgb?.r ?? 0)) * 255)
  }
  return lut
})()

/** OKLCH (0.55 0 145) → (0.84 0.4 145) の補間で彩度対応色を返す。sRGB ガマット内にクランプ */
function chromaFillColor(t: number): string {
  const l = 0.55 + t * (0.84 - 0.55)
  const c = t * 0.4
  const clamped = clampChroma({ mode: 'oklch', l, c, h: 145 }, 'oklch')
  return formatHex(clamped) ?? `rgb(128,128,128)`
}

const bars = computed(() =>
  props.data.bins.map((bin) => {
    const raw = props.logScale ? Math.log1p(bin.count) : bin.count
    const max = props.logScale ? Math.log1p(maxCount.value) : maxCount.value
    const h = Math.round((raw / max) * svgHeight)
    const mid = (bin.rangeStart + bin.rangeEnd) / 2
    const domain = props.data.domain
    const t = domain[1] > domain[0] ? (mid - domain[0]) / (domain[1] - domain[0]) : 0
    const gray = props.useGrayscaleFill
      ? lightnessToSrgbLut[Math.min(Math.round(t * 255), 255)]!
      : 0
    const fill = props.useGrayscaleFill
      ? `rgb(${gray},${gray},${gray})`
      : props.useChromaFill
        ? chromaFillColor(t)
        : props.fillColor
    return { y: svgHeight - h, h, fill }
  }),
)
</script>
