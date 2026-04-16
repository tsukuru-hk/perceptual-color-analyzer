<template>
  <!-- カラークラスタのバブルパッキング可視化 -->
  <div ref="containerRef" class="w-full overflow-x-auto">
    <svg
      v-if="renderGroups.length > 0 || renderBubbles.length > 0"
      :viewBox="`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`"
      :style="{ width: '100%', height: svgHeight + 'px', display: 'block' }"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="bubble-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0.5" stdDeviation="1.2" flood-opacity="0.25" flood-color="#000" />
        </filter>
        <filter id="group-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="2.5" flood-opacity="0.18" flood-color="#000" />
        </filter>
      </defs>
      <!-- 背景レイヤー: グループバブル（エンベロープ） -->
      <circle
        v-for="g in renderGroups"
        :key="`g-${g.key}`"
        :cx="g.cx"
        :cy="g.cy"
        :r="g.r"
        :fill="g.fill"
        :opacity="g.opacity"
        filter="url(#group-shadow)"
        class="bubble-transition"
      />
      <!-- 前景レイヤー: 個別バブル -->
      <circle
        v-for="b in renderBubbles"
        :key="b.key"
        :cx="b.cx"
        :cy="b.cy"
        :r="b.r"
        :fill="b.fill"
        :opacity="b.opacity"
        filter="url(#bubble-shadow)"
        class="bubble-transition"
      />
    </svg>
    <div v-else class="py-8 text-center text-sm text-muted-foreground">
      クラスタリング結果がありません
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { packSiblings, packEnclose } from 'd3-hierarchy'
import { forceSimulation, forceX, forceY, forceCollide } from 'd3-force'
import type { ColorClusterResult, ColorCluster, ColorSample } from '@/domain/colorCluster'
import type { OklchValue } from '@/domain/oklch'

const TRANSITION_MS = 600

const props = withDefaults(defineProps<{
  data: ColorClusterResult
  height?: number
}>(), {
  height: 240,
})

defineEmits<{
  'cluster-select': [clusterId: number]
}>()

const containerRef = ref<HTMLDivElement>()
const svgHeight = computed(() => props.height)
const planeSize = computed(() => svgHeight.value)

// --- 描画用の型 ---
interface RenderCircle {
  key: number
  cx: number
  cy: number
  r: number
  fill: string
  opacity: number
}

const renderGroups = ref<RenderCircle[]>([])
const renderBubbles = ref<RenderCircle[]>([])

function rgbToFill(rgb: { r: number; g: number; b: number }): string {
  return `rgb(${rgb.r},${rgb.g},${rgb.b})`
}

function averageRgb(samples: ColorSample[]): { r: number; g: number; b: number } {
  if (samples.length === 0) return { r: 128, g: 128, b: 128 }
  const sum = { r: 0, g: 0, b: 0 }
  for (const s of samples) {
    sum.r += s.rgb.r
    sum.g += s.rgb.g
    sum.b += s.rgb.b
  }
  return {
    r: Math.round(sum.r / samples.length),
    g: Math.round(sum.g / samples.length),
    b: Math.round(sum.b / samples.length),
  }
}

// ─── 安定ID管理 ───
// 重心の OKLCH 距離で新旧クラスタをマッチングし、安定IDを引き継ぐ。
// マッチしなかった新クラスタにはフレッシュIDを付与。

let stableIdCounter = 0

/** 前回のクラスタ情報（安定ID → 重心） */
const prevClusterCentroids = new Map<number, OklchValue>()

/** 現在の clusterId → stableId マッピング */
const clusterStableIdMap = new Map<number, number>()

/** OKLCH 距離の二乗（hue は円環差） */
function oklchDistSq(a: OklchValue, b: OklchValue): number {
  const dL = a.lightness - b.lightness
  const dC = a.chroma - b.chroma
  let dH = Math.abs(a.hue - b.hue)
  if (dH > 180) dH = 360 - dH
  return dL * dL + dC * dC + (dH / 180) * (dH / 180)
}

/**
 * 新しいクラスタ一覧に安定IDを割り当てる。
 * 前回クラスタと重心が近いものはIDを引き継ぎ、新規にはフレッシュIDを振る。
 */
function assignStableIds(clusters: ReadonlyArray<ColorCluster>): void {
  const oldEntries = [...prevClusterCentroids.entries()] // [stableId, centroid]
  const matched = new Set<number>() // 使用済みの旧 stableId

  clusterStableIdMap.clear()

  // 貪欲マッチング: 各新クラスタに最も近い未マッチの旧クラスタを割り当て
  for (const cluster of clusters) {
    let bestId = -1
    let bestDist = Infinity
    for (const [sid, oldCentroid] of oldEntries) {
      if (matched.has(sid)) continue
      const d = oklchDistSq(cluster.centroid, oldCentroid)
      if (d < bestDist) {
        bestDist = d
        bestId = sid
      }
    }
    // 閾値: 十分近ければマッチ（L差0.15, C差0.08, H差30° 程度）
    if (bestId >= 0 && bestDist < 0.05) {
      clusterStableIdMap.set(cluster.id, bestId)
      matched.add(bestId)
    } else {
      clusterStableIdMap.set(cluster.id, stableIdCounter++)
    }
  }

  // 次回用に現在の重心を保存
  prevClusterCentroids.clear()
  for (const cluster of clusters) {
    prevClusterCentroids.set(clusterStableIdMap.get(cluster.id)!, cluster.centroid)
  }
}

function getStableId(clusterId: number): number {
  return clusterStableIdMap.get(clusterId) ?? clusterId
}

// ─── レイアウト ───

interface BubbleNode {
  sampleId: number
  clusterId: number
  x: number
  y: number
  r: number
  fill: string
}

interface ClusterGroup {
  clusterId: number
  stableId: number
  envelope: { x: number; y: number; r: number }
  envelopeFill: string
  bubbles: BubbleNode[]
  ratio: number
}

function hueToX(hue: number, chroma: number, size: number): number {
  const chromaWeight = Math.min(chroma / 0.15, 1)
  const hueX = (hue / 360) * size
  const center = size / 2
  return center + (hueX - center) * chromaWeight
}

function lightnessToY(lightness: number, size: number): number {
  return (1 - lightness) * size
}

const layout = computed<ClusterGroup[]>(() => {
  const { clusters, samples } = props.data
  if (clusters.length === 0) return []

  // 安定IDを割り当て
  assignStableIds(clusters)

  const size = planeSize.value

  const samplesByCluster = new Map<number, ColorSample[]>()
  for (const s of samples) {
    let arr = samplesByCluster.get(s.clusterId)
    if (!arr) {
      arr = []
      samplesByCluster.set(s.clusterId, arr)
    }
    arr.push(s)
  }

  const totalSamples = samples.length
  const bubbleR = Math.max(size / (Math.sqrt(totalSamples) * 2.6), 4)

  const groups: ClusterGroup[] = []

  for (const cluster of clusters) {
    const clusterSamples = samplesByCluster.get(cluster.id) ?? []
    if (clusterSamples.length === 0) continue

    const circles = clusterSamples.map((s) => ({
      sampleId: s.id,
      clusterId: cluster.id,
      r: bubbleR,
      x: 0,
      y: 0,
      fill: rgbToFill(s.rgb),
    }))

    packSiblings(circles)

    const envelope = packEnclose(circles) ?? { x: 0, y: 0, r: bubbleR }
    envelope.r += bubbleR * 0.4

    const avgColor = averageRgb(clusterSamples)

    groups.push({
      clusterId: cluster.id,
      stableId: getStableId(cluster.id),
      envelope: { x: envelope.x, y: envelope.y, r: envelope.r },
      envelopeFill: rgbToFill(avgColor),
      bubbles: circles,
      ratio: cluster.ratio,
    })
  }

  // d3-force で色相×明度の正方形平面に配置
  const nodes = groups.map((g, i) => {
    const cluster = clusters.find((c) => c.id === g.clusterId)!
    const { lightness, chroma, hue } = cluster.centroid
    return {
      index: i,
      x: hueToX(hue, chroma, size),
      y: lightnessToY(lightness, size),
      targetX: hueToX(hue, chroma, size),
      targetY: lightnessToY(lightness, size),
      r: g.envelope.r,
    }
  })

  const sim = forceSimulation(nodes)
    .force('x', forceX<typeof nodes[number]>((d) => d.targetX).strength(0.4))
    .force('y', forceY<typeof nodes[number]>((d) => d.targetY).strength(0.6))
    .force('collide', forceCollide<typeof nodes[number]>((d) => d.r + 2).strength(0.8).iterations(3))
    .stop()

  for (let i = 0; i < 120; i++) sim.tick()

  for (const node of nodes) {
    const group = groups[node.index]
    const dx = node.x - group.envelope.x
    const dy = node.y - group.envelope.y
    group.envelope.x = node.x
    group.envelope.y = node.y
    for (const b of group.bubbles) {
      b.x += dx
      b.y += dy
    }
  }

  return groups
})

// ─── 描画リスト差分更新 ───

watch(layout, (newLayout) => {
  // --- グループ（安定IDをキーにする） ---
  const newGroupByStableId = new Map<number, ClusterGroup>()
  for (const g of newLayout) newGroupByStableId.set(g.stableId, g)

  const prevGroupKeys = new Set(
    renderGroups.value.filter((g) => g.opacity > 0).map((g) => g.key),
  )
  const nextGroupKeys = new Set(newGroupByStableId.keys())

  const nextGroups: RenderCircle[] = []

  for (const g of newLayout) {
    const isNew = !prevGroupKeys.has(g.stableId)
    nextGroups.push({
      key: g.stableId,
      cx: g.envelope.x,
      cy: g.envelope.y,
      r: g.envelope.r,
      fill: g.envelopeFill,
      opacity: isNew ? 0 : 0.92,
    })
  }

  // 退場
  for (const prev of renderGroups.value) {
    if (!nextGroupKeys.has(prev.key) && prev.opacity > 0) {
      nextGroups.push({ ...prev, opacity: 0 })
    }
  }

  renderGroups.value = nextGroups

  // --- 個別バブル（sampleId = ピクセルインデックスで安定） ---
  const allBubbles = newLayout.flatMap((g) => g.bubbles)
  const prevBubbleKeys = new Set(
    renderBubbles.value.filter((b) => b.opacity > 0).map((b) => b.key),
  )
  const nextBubbleKeys = new Set(allBubbles.map((b) => b.sampleId))

  const nextBubbles: RenderCircle[] = []

  for (const b of allBubbles) {
    const isNew = !prevBubbleKeys.has(b.sampleId)
    nextBubbles.push({
      key: b.sampleId,
      cx: b.x,
      cy: b.y,
      r: b.r,
      fill: b.fill,
      opacity: isNew ? 0 : 1,
    })
  }

  for (const prev of renderBubbles.value) {
    if (!nextBubbleKeys.has(prev.key) && prev.opacity > 0) {
      nextBubbles.push({ ...prev, opacity: 0 })
    }
  }

  renderBubbles.value = nextBubbles

  // フェードイン: DOM挿入後に opacity をターゲット値にセット
  nextTick(() => {
    renderGroups.value = renderGroups.value.map((g) =>
      g.opacity === 0 && nextGroupKeys.has(g.key)
        ? { ...g, opacity: 0.92 }
        : g,
    )
    renderBubbles.value = renderBubbles.value.map((b) =>
      b.opacity === 0 && nextBubbleKeys.has(b.key)
        ? { ...b, opacity: 1 }
        : b,
    )

    // フェードアウト完了後に退場要素を除去
    setTimeout(() => {
      renderGroups.value = renderGroups.value.filter(
        (g) => g.opacity > 0 || nextGroupKeys.has(g.key),
      )
      renderBubbles.value = renderBubbles.value.filter(
        (b) => b.opacity > 0 || nextBubbleKeys.has(b.key),
      )
    }, TRANSITION_MS)
  })
}, { immediate: true })

/** SVG viewBox */
const viewBox = computed(() => {
  if (renderGroups.value.length === 0) return { x: 0, y: 0, w: 100, h: 100 }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const g of renderGroups.value) {
    minX = Math.min(minX, g.cx - g.r)
    maxX = Math.max(maxX, g.cx + g.r)
    minY = Math.min(minY, g.cy - g.r)
    maxY = Math.max(maxY, g.cy + g.r)
  }

  const pad = 8
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  }
})
</script>

<style scoped>
.bubble-transition {
  transition:
    cx 600ms ease-in-out,
    cy 600ms ease-in-out,
    r 600ms ease-in-out,
    fill 400ms ease,
    opacity 500ms ease;
}
</style>
