<template>
  <!-- カラークラスタのバブルパッキング可視化 -->
  <div ref="containerRef" class="relative w-full overflow-x-auto">
    <svg
      v-if="renderGroups.length > 0 || renderBubbles.length > 0"
      ref="svgRef"
      :viewBox="`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`"
      :style="{ width: '100%', height: props.height + 'px', display: 'block' }"
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
        @mouseenter="showTooltip($event, g.fill)"
        @mouseleave="hideTooltip"
        @click="copyHex(g.fill)"
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
        @mouseenter="showTooltip($event, b.fill)"
        @mouseleave="hideTooltip"
        @click="copyHex(b.fill)"
      />
    </svg>
    <div v-else class="py-8 text-center text-sm text-muted-foreground">
      クラスタリング結果がありません
    </div>
    <!-- ツールチップ（コンテナ上に絶対配置） -->
    <Transition name="tooltip-fade">
      <div
        v-if="tooltip.visible"
        class="svg-color-tooltip"
        :class="{ copied: tooltip.copied }"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        <span class="svg-color-tooltip-text">{{ tooltip.copied ? 'Copied!' : tooltip.hex }}</span>
        <div class="svg-color-tooltip-arrow" :class="{ copied: tooltip.copied }" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { packSiblings, packEnclose } from 'd3-hierarchy'
import { forceSimulation, forceX, forceY, forceCollide } from 'd3-force'
import type { ColorClusterResult, ColorCluster, ColorSample } from '@/domain/colorCluster'
import type { OklchValue } from '@/domain/oklch'

const TRANSITION_MS = 600

const props = withDefaults(defineProps<{
  data: ColorClusterResult
  imageId: string
  height?: number
}>(), {
  height: 240,
})

const containerRef = ref<HTMLDivElement>()
const svgRef = ref<SVGSVGElement>()

// ─── カラーコードツールチップ ───

const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  hex: '',
  copied: false,
})

function rgbStringToHex(fill: string): string {
  const m = fill.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!m) return fill
  return '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')
}

function showTooltip(event: MouseEvent, fill: string) {
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  const el = event.currentTarget as SVGCircleElement
  const circleRect = el.getBoundingClientRect()
  tooltip.value = {
    visible: true,
    x: circleRect.left + circleRect.width / 2 - rect.left,
    y: circleRect.top - rect.top,
    hex: rgbStringToHex(fill),
    copied: false,
  }
}

function hideTooltip() {
  tooltip.value.visible = false
  tooltip.value.copied = false
}

async function copyHex(fill: string) {
  const hex = rgbStringToHex(fill)
  try {
    await navigator.clipboard.writeText(hex)
    tooltip.value.copied = true
    setTimeout(() => { tooltip.value.copied = false }, 1200)
  } catch { /* ignore */ }
}

// --- 描画用の型 ---
interface RenderCircle {
  key: number
  cx: number
  cy: number
  r: number
  fill: string
  opacity: number
}

/** グループとバブルをまとめて1回の代入で更新し、描画タイミングを同期する */
const renderState = ref<{ groups: RenderCircle[]; bubbles: RenderCircle[] }>({
  groups: [],
  bubbles: [],
})
const renderGroups = computed(() => renderState.value.groups)
const renderBubbles = computed(() => renderState.value.bubbles)

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
// 画像が変わったらリセットし、クロス画像のマッチングを防ぐ。

let stableIdCounter = 0
let prevImageId = ''

/** 前回のクラスタ情報（安定ID → 重心） */
const prevClusterCentroids = new Map<number, OklchValue>()

/** 現在の clusterId → stableId マッピング */
const clusterStableIdMap = new Map<number, number>()

/** 画像が変わったかどうかを判定し、変わっていたら安定IDをリセット */
function resetIfImageChanged(imageId: string): boolean {
  if (imageId === prevImageId) return false
  prevImageId = imageId
  stableIdCounter = 0
  prevClusterCentroids.clear()
  clusterStableIdMap.clear()
  return true
}

/** OKLCH 距離の二乗（直交座標ベース ΔEok） */
function oklchDistSq(a: OklchValue, b: OklchValue): number {
  const dL = a.lightness - b.lightness
  const aHrad = (a.hue * Math.PI) / 180
  const bHrad = (b.hue * Math.PI) / 180
  const da = a.chroma * Math.cos(aHrad) - b.chroma * Math.cos(bHrad)
  const db = a.chroma * Math.sin(aHrad) - b.chroma * Math.sin(bHrad)
  return dL * dL + da * da + db * db
}

/**
 * 新しいクラスタ一覧に安定IDを割り当てる。
 * 貪欲マッチング: クラスタ数が少ない（<10程度）前提で十分な精度。
 * 前回クラスタと重心が近いものはIDを引き継ぎ、新規にはフレッシュIDを振る。
 */
function assignStableIds(clusters: ReadonlyArray<ColorCluster>): void {
  const oldEntries = [...prevClusterCentroids.entries()] // [stableId, centroid]
  const matched = new Set<number>() // 使用済みの旧 stableId

  clusterStableIdMap.clear()

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
    const sid = clusterStableIdMap.get(cluster.id)
    if (sid != null) prevClusterCentroids.set(sid, cluster.centroid)
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

// ─── バブル位置キャッシュ ───
// サンプルのクラスタ内オフセットを記憶し、同じクラスタに残っている場合は再利用。
// キー: sampleId → { stableClusterId, dx, dy }
interface BubbleCacheEntry {
  stableClusterId: number
  dx: number
  dy: number
}
const bubbleOffsetCache = new Map<number, BubbleCacheEntry>()

interface LayoutResult {
  groups: ClusterGroup[]
  isNewImage: boolean
}

/** レイアウト計算（副作用: 安定ID・キャッシュ更新を含む） */
function buildLayout(data: ColorClusterResult, imageId: string, size: number): LayoutResult {
  const { clusters, samples } = data
  if (clusters.length === 0) return { groups: [], isNewImage: false }

  const isNewImage = resetIfImageChanged(imageId)
  if (isNewImage) bubbleOffsetCache.clear()

  assignStableIds(clusters)

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
  const bubbleR = totalSamples > 0
    ? Math.max(size / (Math.sqrt(totalSamples) * 2.6), 4)
    : 4

  const groups: ClusterGroup[] = []
  const newOffsetCache = new Map<number, BubbleCacheEntry>()

  for (const cluster of clusters) {
    const clusterSamples = samplesByCluster.get(cluster.id) ?? []
    if (clusterSamples.length === 0) continue

    const stableId = getStableId(cluster.id)

    // キャッシュヒット = 同じクラスタに残っているサンプルのみ
    const retained: BubbleNode[] = []
    const incoming: BubbleNode[] = []

    for (const s of clusterSamples) {
      const cached = bubbleOffsetCache.get(s.id)
      // 同じクラスタに残っている場合のみキャッシュを使う
      const isSameCluster = cached && cached.stableClusterId === stableId
      const node: BubbleNode = {
        sampleId: s.id,
        clusterId: cluster.id,
        r: bubbleR,
        x: isSameCluster ? cached.dx : 0,
        y: isSameCluster ? cached.dy : 0,
        fill: rgbToFill(s.rgb),
      }
      if (isSameCluster) {
        retained.push(node)
      } else {
        incoming.push(node)
      }
    }

    let allCircles: BubbleNode[]

    if (retained.length === 0) {
      // 全て新規: 通常のパッキング
      allCircles = [...incoming]
      packSiblings(allCircles)
    } else if (incoming.length === 0) {
      // 全てキャッシュヒット: そのまま使用
      allCircles = retained
    } else {
      // 混在: retained を先頭にして全体をパッキング
      // packSiblings は入力順に配置するので、先頭の既存サンプルが安定位置を得やすい
      allCircles = [...retained, ...incoming]
      packSiblings(allCircles)
    }

    const envelope = packEnclose(allCircles) ?? { x: 0, y: 0, r: bubbleR }
    envelope.r += bubbleR * 0.4

    // 新しいオフセットをキャッシュに保存（envelope 中心からのオフセット）
    for (const c of allCircles) {
      newOffsetCache.set(c.sampleId, {
        stableClusterId: stableId,
        dx: c.x - envelope.x,
        dy: c.y - envelope.y,
      })
    }

    const avgColor = averageRgb(clusterSamples)

    groups.push({
      clusterId: cluster.id,
      stableId,
      envelope: { x: envelope.x, y: envelope.y, r: envelope.r },
      envelopeFill: rgbToFill(avgColor),
      bubbles: allCircles,
      ratio: cluster.ratio,
    })
  }

  // d3-force で色相×明度の正方形平面に配置
  // groups は clusters から生成しているので clusterMap.get は必ずヒットする
  const clusterMap = new Map(clusters.map((c) => [c.id, c]))

  const nodes = groups.map((g, i) => {
    const cluster = clusterMap.get(g.clusterId)!
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
    .force('x', forceX<(typeof nodes)[number]>((d) => d.targetX).strength(0.4))
    .force('y', forceY<(typeof nodes)[number]>((d) => d.targetY).strength(0.6))
    .force('collide', forceCollide<(typeof nodes)[number]>((d) => d.r + 2).strength(0.8).iterations(3))
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

  // キャッシュを今回の結果で置き換え
  bubbleOffsetCache.clear()
  for (const [id, entry] of newOffsetCache) bubbleOffsetCache.set(id, entry)

  return { groups, isNewImage }
}

// ─── データ変更 → レイアウト計算 → 描画更新 ───

/**
 * 進行中のアニメーション処理をキャンセルするためのトークン。
 * 連続更新時、古い nextTick / setTimeout コールバックが
 * 最新の nextKeys セットではなく過去のキャプチャで動作してしまうのを防ぐ。
 */
let animationToken = 0
let pendingCleanupTimer: ReturnType<typeof setTimeout> | null = null

function cancelPendingAnimation(): void {
  animationToken++
  if (pendingCleanupTimer != null) {
    clearTimeout(pendingCleanupTimer)
    pendingCleanupTimer = null
  }
}

onBeforeUnmount(() => {
  cancelPendingAnimation()
})

watch(
  [() => props.data, () => props.imageId, () => props.height],
  ([data, imageId, height]) => {
    const { groups: newLayout, isNewImage } = buildLayout(data, imageId, height)

    // 前回の watch が残した nextTick / setTimeout を破棄
    cancelPendingAnimation()
    const token = ++animationToken

    // 画像が変わった場合: アニメーションなしで即座に最終状態を表示
    if (isNewImage) {
      renderState.value = {
        groups: newLayout.map((g) => ({
          key: g.stableId,
          cx: g.envelope.x,
          cy: g.envelope.y,
          r: g.envelope.r,
          fill: g.envelopeFill,
          opacity: 0.92,
        })),
        bubbles: newLayout.flatMap((g) =>
          g.bubbles.map((b) => ({
            key: b.sampleId,
            cx: b.x,
            cy: b.y,
            r: b.r,
            fill: b.fill,
            opacity: 1,
          })),
        ),
      }
      return
    }

    // 同じ画像内での変化: 差分アニメーション
    const prev = renderState.value

    const prevGroupKeys = new Set(
      prev.groups.filter((g) => g.opacity > 0).map((g) => g.key),
    )
    const nextGroupKeys = new Set(newLayout.map((g) => g.stableId))

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
    for (const p of prev.groups) {
      if (!nextGroupKeys.has(p.key) && p.opacity > 0) {
        nextGroups.push({ ...p, opacity: 0 })
      }
    }

    const allBubbles = newLayout.flatMap((g) => g.bubbles)
    const prevBubbleKeys = new Set(
      prev.bubbles.filter((b) => b.opacity > 0).map((b) => b.key),
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
    for (const p of prev.bubbles) {
      if (!nextBubbleKeys.has(p.key) && p.opacity > 0) {
        nextBubbles.push({ ...p, opacity: 0 })
      }
    }

    renderState.value = { groups: nextGroups, bubbles: nextBubbles }

    nextTick(() => {
      // 新しい watch が開始されていたら、古いトークンは無効
      if (token !== animationToken) return

      const cur = renderState.value
      renderState.value = {
        groups: cur.groups.map((g) =>
          g.opacity === 0 && nextGroupKeys.has(g.key)
            ? { ...g, opacity: 0.92 }
            : g,
        ),
        bubbles: cur.bubbles.map((b) =>
          b.opacity === 0 && nextBubbleKeys.has(b.key)
            ? { ...b, opacity: 1 }
            : b,
        ),
      }

      pendingCleanupTimer = setTimeout(() => {
        pendingCleanupTimer = null
        if (token !== animationToken) return

        const c = renderState.value
        renderState.value = {
          groups: c.groups.filter(
            (g) => g.opacity > 0 || nextGroupKeys.has(g.key),
          ),
          bubbles: c.bubbles.filter(
            (b) => b.opacity > 0 || nextBubbleKeys.has(b.key),
          ),
        }
      }, TRANSITION_MS)
    })
  },
  { immediate: true },
)

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
  cursor: pointer;
}

.svg-color-tooltip {
  position: absolute;
  transform: translate(-50%, -100%);
  margin-top: -6px;
  padding: 3px 7px;
  background: #1a1a1a;
  color: #f0f0f0;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  line-height: 1.4;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 50;
}

.svg-color-tooltip.copied {
  background: #166534;
}

.svg-color-tooltip-arrow {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: #1a1a1a;
}

.svg-color-tooltip-arrow.copied {
  border-top-color: #166534;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 150ms ease;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}
</style>
