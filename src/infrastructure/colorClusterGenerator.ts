/**
 * 画像ピクセルからカラーパレットを抽出する。
 * Infrastructure: Culori 経由の色変換に依存。
 *
 * 色相×明度×彩度の細粒度グリッドで色空間を分割し、
 * 粒度パラメータに応じて自動的にパレット数を決定する。
 */
import { type Result, success } from '@/core/result'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import type { ColorClusterResult, ColorSample, ColorCluster } from '@/domain/colorCluster'
import { extractPalette, type PalettePoint } from '@/domain/paletteExtractor'
import { createPixelConverter } from '@/infrastructure/colorSpaceConverter'
import { converter, clampChroma, type Rgb } from 'culori'

export type ColorClusterError = 'ConversionError'

/** サンプリングする最大ピクセル数 */
const MAX_SAMPLES = 10_000

/** サブカラーの合計目標数ベース */
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
 * 画像からカラーパレットを抽出する。
 *
 * @param source 色空間情報付き入力画像
 * @param maxColors パレット色数の上限 (0=自動決定, デフォルト: 0)
 */
export function generateColorClusters(
  source: ColorAwareImageData,
  maxColors: number = 0,
): Result<ColorClusterResult, ColorClusterError> {
  const { data, width, height } = source.imageData
  const totalPixels = width * height
  const toOklch = createPixelConverter(source.colorSpace)

  // stride ベースサンプリング
  const stride = Math.max(1, Math.floor(totalPixels / MAX_SAMPLES))

  // Phase 1: ピクセルをサンプリングして PalettePoint 配列を構築
  const points: PalettePoint[] = []
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
      weight: stride,
    })
    rgbValues.push({ r, g, b })
  }

  if (points.length === 0) {
    return success({
      clusters: [],
      samples: [],
      totalPixels,
      k: 0,
    })
  }

  // Phase 2: パレット抽出（maxColors=0 なら自動決定）
  const palette = extractPalette(points, maxColors)

  // Phase 3: ColorCluster 配列を構築（palette は既に totalWeight 降順）
  const totalCounted = palette.reduce((sum, e) => sum + e.totalWeight, 0)

  const clusters: ColorCluster[] = palette.map((entry, id) => {
    const c = entry.centroid
    return {
      id,
      centroid: c,
      centroidRgb: oklchToRgb255(c.lightness, c.chroma, c.hue),
      pixelCount: entry.totalWeight,
      ratio: totalCounted > 0 ? entry.totalWeight / totalCounted : 0,
    }
  })

  // Phase 4: サンプル色を構築
  const paletteSize = palette.length
  const targetTotalSamples = Math.max(BASE_TOTAL_SAMPLES, paletteSize * 3)

  const samples: ColorSample[] = []

  for (let clusterId = 0; clusterId < palette.length; clusterId++) {
    const entry = palette[clusterId]!
    const indices = entry.memberIndices
    if (indices.length === 0) continue

    const cluster = clusters[clusterId]!
    const budget = Math.max(
      MIN_SAMPLES_PER_CLUSTER,
      Math.round(cluster.ratio * targetTotalSamples),
    )
    const maxSub = Math.min(budget, indices.length)

    // 均等にサブサンプリング
    const subStride = Math.max(1, Math.floor(indices.length / maxSub))
    let subCount = 0
    for (let j = 0; j < indices.length && subCount < maxSub; j += subStride) {
      const idx = indices[j]!
      const p = points[idx]!
      const rgb = rgbValues[idx]!
      samples.push({
        id: idx,
        oklch: p.oklch,
        rgb,
        pixelCount: p.weight,
        clusterId,
      })
      subCount++
    }
  }

  return success({ clusters, samples, totalPixels, k: paletteSize })
}
