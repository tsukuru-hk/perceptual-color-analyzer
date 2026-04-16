/**
 * 画像ピクセルからカラークラスタリング結果を生成する。
 * Infrastructure: Culori 経由の色変換に依存。
 */
import { type Result, success } from '@/core/result'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import type { ColorClusterResult, ColorSample, ColorCluster } from '@/domain/colorCluster'
import { kMeansOklch, type KMeansPoint } from '@/domain/kMeansOklch'
import { createPixelConverter } from '@/infrastructure/colorSpaceConverter'
import { converter, clampChroma, type Rgb } from 'culori'

export type ColorClusterError = 'ConversionError'

/** サンプリングする最大ピクセル数 */
const MAX_SAMPLES = 10_000

/** サブカラーの合計目標数ベース（k に応じてスケール） */
const BASE_TOTAL_SAMPLES = 200

/** 1 クラスタあたりの最低サブカラー数 */
const MIN_SAMPLES_PER_CLUSTER = 2

const toRgb = converter('rgb')

/**
 * OKLCH 重心値を sRGB (0-255) に逆変換する。
 * ガマット外の場合は clampChroma で最も近い sRGB 色にクランプ。
 */
function oklchToRgb255(l: number, c: number, h: number): { r: number; g: number; b: number } {
  const clamped = clampChroma({ mode: 'oklch', l, c, h }, 'oklch')
  const rgb = toRgb(clamped) as Rgb
  return {
    r: Math.round(Math.max(0, Math.min(1, rgb.r)) * 255),
    g: Math.round(Math.max(0, Math.min(1, rgb.g)) * 255),
    b: Math.round(Math.max(0, Math.min(1, rgb.b)) * 255),
  }
}

/**
 * 画像からカラークラスタリング結果を生成する。
 *
 * @param source 色空間情報付き入力画像
 * @param k クラスタ数（デフォルト: 12）
 */
export function generateColorClusters(
  source: ColorAwareImageData,
  k: number = 12,
): Result<ColorClusterResult, ColorClusterError> {
  const { data, width, height } = source.imageData
  const totalPixels = width * height
  const toOklch = createPixelConverter(source.colorSpace)

  // stride ベースサンプリング
  const stride = Math.max(1, Math.floor(totalPixels / MAX_SAMPLES))

  // Phase 1: ピクセルをサンプリングして KMeansPoint 配列を構築
  const points: KMeansPoint[] = []
  const rgbValues: Array<{ r: number; g: number; b: number }> = []

  for (let i = 0; i < totalPixels; i += stride) {
    const offset = i * 4
    if (data[offset + 3]! < 128) continue

    const r = data[offset]!
    const g = data[offset + 1]!
    const b = data[offset + 2]!
    const oklch = toOklch(r, g, b)
    if (!oklch) continue

    points.push({
      oklch: { lightness: oklch.l, chroma: oklch.c, hue: oklch.h },
      weight: stride, // 各サンプルが stride ピクセル分を代表
    })
    rgbValues.push({ r, g, b })
  }

  if (points.length === 0) {
    return success({
      clusters: [],
      samples: [],
      totalPixels,
      k,
    })
  }

  // Phase 2: K-means 実行
  const { assignments, centroids } = kMeansOklch(points, { k })

  // Phase 3: クラスタごとのピクセル数を集計
  const clusterPixelCounts = new Float64Array(centroids.length)
  for (let i = 0; i < points.length; i++) {
    clusterPixelCounts[assignments[i]!] += points[i]!.weight
  }
  const totalCounted = clusterPixelCounts.reduce((a, b) => a + b, 0)

  // Phase 4: ratio 降順のソート順を生成（元のクラスタID → ソート後の新ID）
  const sortedIndices = Array.from({ length: centroids.length }, (_, i) => i)
    .sort((a, b) => clusterPixelCounts[b]! - clusterPixelCounts[a]!)

  // oldId → newId のマッピング
  const idRemap = new Int32Array(centroids.length)
  for (let newId = 0; newId < sortedIndices.length; newId++) {
    idRemap[sortedIndices[newId]!] = newId
  }

  // Phase 5: ColorCluster 配列を構築
  const clusters: ColorCluster[] = sortedIndices.map((oldId, newId) => {
    const c = centroids[oldId]!
    return {
      id: newId,
      centroid: c,
      centroidRgb: oklchToRgb255(c.lightness, c.chroma, c.hue),
      pixelCount: clusterPixelCounts[oldId]!,
      ratio: totalCounted > 0 ? clusterPixelCounts[oldId]! / totalCounted : 0,
    }
  })

  // Phase 6: サンプル色を構築（ratio に比例して合計 ~targetTotalSamples を分配）
  // k が大きいほどサンプル総数を増やす（最低 k*2 は確保）
  const targetTotalSamples = Math.max(BASE_TOTAL_SAMPLES, k * 3)
  // クラスタごとにサンプルインデックスを集める
  const clusterSampleIndices: number[][] = Array.from({ length: centroids.length }, () => [])
  for (let i = 0; i < points.length; i++) {
    clusterSampleIndices[assignments[i]!]!.push(i)
  }

  // 各クラスタの割り当てサンプル数を ratio に比例して計算
  const sampleBudgets = new Map<number, number>()
  let budgetUsed = 0
  for (const cluster of clusters) {
    const oldId = sortedIndices[cluster.id]!
    const indices = clusterSampleIndices[oldId]!
    if (indices.length === 0) continue
    const budget = Math.max(
      MIN_SAMPLES_PER_CLUSTER,
      Math.round(cluster.ratio * targetTotalSamples),
    )
    const capped = Math.min(budget, indices.length)
    sampleBudgets.set(cluster.id, capped)
    budgetUsed += capped
  }

  const samples: ColorSample[] = []

  for (let oldId = 0; oldId < centroids.length; oldId++) {
    const indices = clusterSampleIndices[oldId]!
    if (indices.length === 0) continue
    const newClusterId = idRemap[oldId]!
    const maxSub = sampleBudgets.get(newClusterId) ?? MIN_SAMPLES_PER_CLUSTER

    // 均等にサブサンプリング
    const subStride = Math.max(1, Math.floor(indices.length / maxSub))
    let subCount = 0
    for (let j = 0; j < indices.length && subCount < maxSub; j += subStride) {
      const idx = indices[j]!
      const p = points[idx]!
      const rgb = rgbValues[idx]!
      samples.push({
        // ピクセルインデックスをIDに使用 — k が変わっても同一ピクセルは同一ID
        id: idx,
        oklch: p.oklch,
        rgb,
        pixelCount: p.weight,
        clusterId: newClusterId,
      })
      subCount++
    }
  }

  return success({ clusters, samples, totalPixels, k })
}
