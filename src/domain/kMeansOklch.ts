/**
 * OKLCH 空間での K-means クラスタリング。
 * 純粋関数のみで構成し、Worker・メインスレッド双方で使用可能。
 *
 * 距離関数は OKLAB の ΔEok（L, a, b のユークリッド距離）を使用。
 * OKLAB は ΔL, Δa, Δb を等倍で比較したときに知覚均一になるよう設計されており、
 * 追加のスケーリングなしで「知覚的に似た色」を正しくグルーピングできる。
 *
 * OKLCH → OKLAB 変換: a = C·cos(H), b = C·sin(H)
 * これにより低彩度で hue が不安定な場合も a/b 差が自然に縮小する。
 */

import type { OklchValue } from './oklch'

/** K-means 設定 */
export interface KMeansConfig {
  /** クラスタ数 */
  readonly k: number
  /** 最大反復回数 */
  readonly maxIterations: number
}

const DEFAULT_CONFIG: KMeansConfig = {
  k: 12,
  maxIterations: 20,
}

/** K-means への入力点 */
export interface KMeansPoint {
  readonly oklch: OklchValue
  /** この点が代表するピクセル数（重み） */
  readonly weight: number
}

/** K-means の出力 */
export interface KMeansResult {
  /** 各入力点の所属クラスタ ID (0-indexed) */
  readonly assignments: Int32Array
  /** 各クラスタの重心 OKLCH */
  readonly centroids: ReadonlyArray<OklchValue>
}

/**
 * OKLAB 色差 ΔEok の二乗を計算する。
 *
 * OKLCH を直交座標 (L, a, b) に変換してユークリッド距離を取る。
 * OKLAB の設計上、L/a/b は等倍で知覚均一なのでスケーリング不要。
 */
function oklchDistanceSq(a: OklchValue, b: OklchValue): number {
  const dL = a.lightness - b.lightness

  const aHrad = (a.hue * Math.PI) / 180
  const bHrad = (b.hue * Math.PI) / 180
  const da = a.chroma * Math.cos(aHrad) - b.chroma * Math.cos(bHrad)
  const db = a.chroma * Math.sin(aHrad) - b.chroma * Math.sin(bHrad)

  return dL * dL + da * da + db * db
}

/**
 * Hue の循環平均を計算する。
 * 重みつき sin/cos 平均で求める。
 */
function circularMeanHue(
  points: ReadonlyArray<KMeansPoint>,
  assignments: Int32Array,
  clusterId: number,
): number {
  let sinSum = 0
  let cosSum = 0
  let totalWeight = 0

  for (let i = 0; i < points.length; i++) {
    if (assignments[i] !== clusterId) continue
    const p = points[i]!
    const rad = (p.oklch.hue * Math.PI) / 180
    sinSum += Math.sin(rad) * p.weight * p.oklch.chroma
    cosSum += Math.cos(rad) * p.weight * p.oklch.chroma
    totalWeight += p.weight * p.oklch.chroma
  }

  if (totalWeight < 1e-10) return 0
  const mean = (Math.atan2(sinSum / totalWeight, cosSum / totalWeight) * 180) / Math.PI
  return mean < 0 ? mean + 360 : mean
}

/**
 * K-means++ 初期化: 距離に比例した確率で初期重心を選ぶ。
 */
function initCentroidsKMeansPP(
  points: ReadonlyArray<KMeansPoint>,
  k: number,
): OklchValue[] {
  const n = points.length
  const centroids: OklchValue[] = []

  // 最初の重心はランダムに（ただし決定的にするため重みベースで選ぶ）
  let totalWeight = 0
  for (const p of points) totalWeight += p.weight
  let target = totalWeight * 0.5 // 中央値付近の点
  let cumWeight = 0
  let firstIdx = 0
  for (let i = 0; i < n; i++) {
    cumWeight += points[i]!.weight
    if (cumWeight >= target) {
      firstIdx = i
      break
    }
  }
  centroids.push({ ...points[firstIdx]!.oklch })

  const distances = new Float64Array(n)

  for (let c = 1; c < k; c++) {
    // 各点から最近重心までの距離を計算
    let distSum = 0
    for (let i = 0; i < n; i++) {
      let minDist = Infinity
      for (const centroid of centroids) {
        const d = oklchDistanceSq(points[i]!.oklch, centroid)
        if (d < minDist) minDist = d
      }
      distances[i] = minDist * points[i]!.weight
      distSum += distances[i]!
    }

    // 距離に比例した確率で次の重心を選ぶ（決定的: 累積分布の中央値）
    target = distSum * ((c + 0.5) / k)
    let cumDist = 0
    for (let i = 0; i < n; i++) {
      cumDist += distances[i]!
      if (cumDist >= target) {
        centroids.push({ ...points[i]!.oklch })
        break
      }
    }

    // すべての点が距離0の場合のフォールバック
    if (centroids.length <= c) {
      centroids.push({ ...points[c % n]!.oklch })
    }
  }

  return centroids
}

/**
 * OKLCH 空間で K-means クラスタリングを実行する。
 *
 * @param points 入力点の配列
 * @param config K-means 設定（省略時はデフォルト値）
 * @returns 各点の所属クラスタ ID と各クラスタの重心
 */
export function kMeansOklch(
  points: ReadonlyArray<KMeansPoint>,
  config?: Partial<KMeansConfig>,
): KMeansResult {
  const { k, maxIterations } = { ...DEFAULT_CONFIG, ...config }
  const n = points.length

  if (n === 0) {
    return { assignments: new Int32Array(0), centroids: [] }
  }

  const effectiveK = Math.min(k, n)
  const centroids = initCentroidsKMeansPP(points, effectiveK)
  const assignments = new Int32Array(n)

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assignment step
    let changed = false
    for (let i = 0; i < n; i++) {
      let bestCluster = 0
      let bestDist = Infinity
      for (let c = 0; c < effectiveK; c++) {
        const d = oklchDistanceSq(points[i]!.oklch, centroids[c]!)
        if (d < bestDist) {
          bestDist = d
          bestCluster = c
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster
        changed = true
      }
    }

    if (!changed) break

    // Update step: 重みつき平均で重心を再計算
    for (let c = 0; c < effectiveK; c++) {
      let sumL = 0
      let sumC = 0
      let totalWeight = 0

      for (let i = 0; i < n; i++) {
        if (assignments[i] !== c) continue
        const p = points[i]!
        sumL += p.oklch.lightness * p.weight
        sumC += p.oklch.chroma * p.weight
        totalWeight += p.weight
      }

      if (totalWeight > 0) {
        centroids[c] = {
          lightness: sumL / totalWeight,
          chroma: sumC / totalWeight,
          hue: circularMeanHue(points, assignments, c),
        }
      }
    }
  }

  return { assignments, centroids }
}
