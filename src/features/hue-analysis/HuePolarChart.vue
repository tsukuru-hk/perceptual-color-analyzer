<template>
  <!--
    色相分析の極座標チャート:
    外周 = CSS conic-gradient による滑らかな色相環
    内側 = カラーホイール + 白フロスト (使われている色は鮮明、未使用は白)
    オーバーレイ = 代表色ドット
  -->
  <div class="relative w-full">
    <!-- 外周: CSS conic-gradient の色相環リング -->
    <div
      v-if="hasData"
      class="hue-ring-container"
      :style="containerStyle"
    >
      <!-- 色相環リング (背景 = conic-gradient, 中央を白くくり抜く) -->
      <div class="hue-ring" :style="hueRingStyle" />

      <!-- SVG: 内側のガマットマップ + ラベル + ドット -->
      <svg
        class="gamut-svg"
        :viewBox="svgViewBox"
        :style="svgStyle"
      >
        <g :transform="`translate(${svgCenter},${svgCenter})`">
          <!-- Layer 1: ベースカラーホイール（全セルを自然色で描画） -->
          <g class="base-wheel">
            <path
              v-for="cell in baseWheelCells"
              :key="`bw-${cell.key}`"
              :d="cell.d"
              :fill="cell.fill"
            />
          </g>

          <!-- Layer 2: 白フロスト（未使用セルだけ白で覆う） -->
          <g class="frost-layer">
            <path
              v-for="cell in frostCells"
              :key="`fr-${cell.key}`"
              :d="cell.d"
              fill="white"
              :opacity="cell.frostOpacity"
              class="frost-cell"
            />
          </g>

          <!-- Layer 3: 基準線 + 色相ラベル -->
          <g class="reference-layer">
            <line
              v-for="tick in hueTicks"
              :key="`tick-${tick.hue}`"
              :x1="0"
              :y1="0"
              :x2="tick.x2"
              :y2="tick.y2"
              stroke="rgba(255,255,255,0.25)"
              :stroke-width="0.4"
            />
          </g>

          <!-- Layer 4: 代表色ドット -->
          <g v-if="clusterDots.length > 0" class="cluster-overlay">
            <ColorCodeTooltip
              v-for="dot in clusterDots"
              :key="`c-${dot.id}`"
              :rgb="dot.rgb"
            >
              <circle
                :cx="dot.x"
                :cy="dot.y"
                :r="dot.r"
                :fill="dot.fill"
                stroke="rgba(255,255,255,0.9)"
                :stroke-width="1"
                class="cluster-dot"
              />
            </ColorCodeTooltip>
          </g>
        </g>
      </svg>
    </div>

    <!-- 色相ラベル (SVG外に absolute 配置) -->
    <template v-if="hasData">
      <span
        v-for="tick in hueLabelPositions"
        :key="`hl-${tick.hue}`"
        class="hue-label-abs"
        :style="tick.style"
      >{{ tick.label }}</span>
    </template>

    <div v-if="!hasData" class="py-8 text-center text-sm text-muted-foreground">
      色相分析データがありません
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
// @ts-expect-error -- d3 has no type declarations in this project
import { arc as d3Arc, scaleLinear } from 'd3'
import type { HueAnalysisResult, PolarDensityCell, HueSector } from '@/types/hueAnalysis'
import type { ColorClusterResult } from '@/domain/colorCluster'
import ColorCodeTooltip from '@/components/ui/ColorCodeTooltip.vue'

const props = withDefaults(defineProps<{
  data: HueAnalysisResult
  clusterData?: ColorClusterResult | null
  activeBand: 'all' | 'dark' | 'mid' | 'light'
  size?: number
}>(), {
  clusterData: null,
  size: 480,
})

// === レイアウト寸法 ===
const outerRadius = computed(() => props.size / 2)
const ringWidth = computed(() => outerRadius.value * 0.1)
const gamutRadius = computed(() => outerRadius.value - ringWidth.value - 4)
/** SVG は内側のガマットエリアだけをカバー */
const svgSize = computed(() => gamutRadius.value * 2)
const svgCenter = computed(() => gamutRadius.value)
const svgViewBox = computed(() => `0 0 ${svgSize.value} ${svgSize.value}`)

const hasData = computed(() => activeSectors.value.length > 0)

// 現在のバンドに応じたデータ
const activeSectors = computed<ReadonlyArray<HueSector>>(() => {
  if (props.activeBand === 'all') return props.data.sectors
  const band = props.data.lightnessBands.find((b) => b.label === props.activeBand)
  return band?.sectors ?? []
})

const activeDensityCells = computed<ReadonlyArray<PolarDensityCell>>(() => {
  if (props.activeBand === 'all') return props.data.densityCells
  const band = props.data.lightnessBands.find((b) => b.label === props.activeBand)
  return band?.densityCells ?? []
})

// === CSS スタイル ===
const containerStyle = computed(() => ({
  width: props.size + 'px',
  height: props.size + 'px',
  margin: '0 auto',
  position: 'relative' as const,
}))

/** conic-gradient で色相環を生成。OKLCH の hue 0° = 赤を12時方向に */
const hueRingStyle = computed(() => {
  // conic-gradient の 0° は 12時方向(上), 時計回り = OKLCH hue と一致
  const stops: string[] = []
  const sectors = props.data.sectors
  for (const sector of sectors) {
    const { r, g, b } = sector.fillRgb
    stops.push(`rgb(${r},${g},${b}) ${sector.hueStart}deg ${sector.hueEnd}deg`)
  }
  // 最後のセクターから最初のセクターへの補間用に先頭色を末尾に追加
  if (sectors.length > 0) {
    const first = sectors[0]!
    stops.push(`rgb(${first.fillRgb.r},${first.fillRgb.g},${first.fillRgb.b}) 360deg`)
  }
  const innerPercent = ((outerRadius.value - ringWidth.value) / outerRadius.value * 100).toFixed(1)
  return {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: `conic-gradient(from 0deg, ${stops.join(', ')})`,
    mask: `radial-gradient(circle, transparent ${innerPercent}%, black ${innerPercent}%)`,
    WebkitMask: `radial-gradient(circle, transparent ${innerPercent}%, black ${innerPercent}%)`,
  }
})

const svgStyle = computed(() => {
  const offset = ringWidth.value + 4
  return {
    position: 'absolute' as const,
    top: offset + 'px',
    left: offset + 'px',
    width: svgSize.value + 'px',
    height: svgSize.value + 'px',
  }
})

// === D3 角度変換 ===
function hueToD3Angle(hue: number): number {
  return (hue * Math.PI) / 180
}

function hueToMathAngle(hue: number): number {
  return ((hue - 90) * Math.PI) / 180
}

// === 密度 lookup ===
const densityMap = computed(() => {
  const map = new Map<string, number>()
  for (const cell of activeDensityCells.value) {
    map.set(`${cell.hueBin},${cell.chromaBin}`, cell.density)
  }
  return map
})

// === ベースカラーホイール ===
interface WheelCell {
  key: string
  d: string
  fill: string
}

const baseWheelCells = computed<WheelCell[]>(() => {
  const hueBinCount = props.data.hueBinCount
  const chromaBinCount = props.data.chromaBinCount
  const maxChroma = props.data.maxChroma
  const colors = props.data.wheelColors
  if (maxChroma === 0 || colors.length === 0) return []

  const chromaScale = scaleLinear()
    .domain([0, maxChroma])
    .range([0, gamutRadius.value])

  const chromaBinWidth = maxChroma / chromaBinCount
  const hueBinWidth = 360 / hueBinCount
  const arcGen = d3Arc()

  const cells: WheelCell[] = []

  for (let h = 0; h < hueBinCount; h++) {
    for (let c = 0; c < chromaBinCount; c++) {
      const d = arcGen({
        innerRadius: chromaScale(c * chromaBinWidth),
        outerRadius: chromaScale((c + 1) * chromaBinWidth),
        startAngle: hueToD3Angle(h * hueBinWidth),
        endAngle: hueToD3Angle((h + 1) * hueBinWidth),
      })
      const rgb = colors[h * chromaBinCount + c] ?? { r: 128, g: 128, b: 128 }
      cells.push({
        key: `${h}-${c}`,
        d: d ?? '',
        fill: `rgb(${rgb.r},${rgb.g},${rgb.b})`,
      })
    }
  }
  return cells
})

// === フロストオーバーレイ（二値化: 未使用=白, 使用=透明） ===
interface FrostCell {
  key: string
  d: string
  frostOpacity: number
}

const frostCells = computed<FrostCell[]>(() => {
  const hueBinCount = props.data.hueBinCount
  const chromaBinCount = props.data.chromaBinCount
  const maxChroma = props.data.maxChroma
  if (maxChroma === 0) return []

  const chromaScale = scaleLinear()
    .domain([0, maxChroma])
    .range([0, gamutRadius.value])

  const chromaBinWidth = maxChroma / chromaBinCount
  const hueBinWidth = 360 / hueBinCount
  const arcGen = d3Arc()
  const dMap = densityMap.value

  const cells: FrostCell[] = []

  for (let h = 0; h < hueBinCount; h++) {
    for (let c = 0; c < chromaBinCount; c++) {
      const density = dMap.get(`${h},${c}`) ?? 0
      // 二値化: 使われていたら透明(0)、未使用なら白(0.93)
      const frostOpacity = density > 0 ? 0 : 0.93

      const d = arcGen({
        innerRadius: chromaScale(c * chromaBinWidth),
        outerRadius: chromaScale((c + 1) * chromaBinWidth),
        startAngle: hueToD3Angle(h * hueBinWidth),
        endAngle: hueToD3Angle((h + 1) * hueBinWidth),
      })

      cells.push({
        key: `${h}-${c}`,
        d: d ?? '',
        frostOpacity,
      })
    }
  }
  return cells
})

// === 基準線 ===
interface HueTick {
  hue: number
  x2: number; y2: number
}

const hueTicks = computed<HueTick[]>(() => {
  const ticks: HueTick[] = []
  for (let hue = 0; hue < 360; hue += 30) {
    const angle = hueToMathAngle(hue)
    ticks.push({
      hue,
      x2: gamutRadius.value * Math.cos(angle),
      y2: gamutRadius.value * Math.sin(angle),
    })
  }
  return ticks
})

// === 色相ラベル (CSS absolute 配置) ===
const HUE_LABELS: Record<number, string> = {
  0: 'R', 60: 'Y', 120: 'G', 180: 'C', 240: 'B', 300: 'M',
}

const hueLabelPositions = computed(() => {
  const result: { hue: number; label: string; style: Record<string, string> }[] = []
  const center = props.size / 2
  const labelR = outerRadius.value + 14

  for (let hue = 0; hue < 360; hue += 60) {
    const label = HUE_LABELS[hue]
    if (!label) continue
    const angle = hueToMathAngle(hue)
    const x = center + labelR * Math.cos(angle)
    const y = center + labelR * Math.sin(angle)
    result.push({
      hue,
      label,
      style: {
        position: 'absolute',
        left: x + 'px',
        top: y + 'px',
        transform: 'translate(-50%, -50%)',
      },
    })
  }
  return result
})

// === 代表色ドット ===
interface ClusterDot {
  id: number
  x: number; y: number
  r: number
  fill: string
  rgb: { r: number; g: number; b: number }
}

const clusterDots = computed<ClusterDot[]>(() => {
  const clusters = props.clusterData
  if (!clusters) return []

  const chromaScale = scaleLinear()
    .domain([0, props.data.maxChroma])
    .range([0, gamutRadius.value])

  return clusters.clusters
    .filter((c) => c.centroid.chroma >= 0.01)
    .map((c) => {
      const angle = hueToMathAngle(c.centroid.hue)
      const r = chromaScale(c.centroid.chroma)
      const dotRadius = Math.max(4, Math.sqrt(c.ratio) * 24)
      return {
        id: c.id,
        x: r * Math.cos(angle),
        y: r * Math.sin(angle),
        r: dotRadius,
        fill: `rgb(${c.centroidRgb.r},${c.centroidRgb.g},${c.centroidRgb.b})`,
        rgb: c.centroidRgb,
      }
    })
})
</script>

<style scoped>
.hue-ring-container {
  position: relative;
}

.hue-ring {
  position: absolute;
  top: 0;
  left: 0;
}

.gamut-svg {
  display: block;
}

.frost-cell {
  transition: opacity 400ms ease;
}

.cluster-dot {
  transition: cx 400ms ease, cy 400ms ease, r 400ms ease;
  cursor: pointer;
}

.hue-label-abs {
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  font-family: ui-monospace, monospace;
  user-select: none;
  pointer-events: none;
}
</style>
