/**
 * 色相×明度×彩度グリッドによるカラーパレット抽出。
 *
 * 細粒度の 3D グリッド（色相24×明度5×彩度3 + 無彩色5 = 最大365セル）で
 * 色空間を分割し、ピクセルが存在するセルだけを候補にする。
 *
 * パレット数の決定:
 *   - maxColors 未指定(0) → 微小セル吸収後の占有セル数をそのまま採用（自動）
 *   - maxColors 指定 → その数になるまで ΔEok が最小のペアを順次マージ
 */

import type { OklchValue } from './oklch'

// ─── グリッド設定 ───

const HUE_SEGMENTS = 24
const LIGHTNESS_BANDS = 5
const CHROMA_BANDS = 3

/** これ以下の chroma は無彩色として扱う */
const ACHROMATIC_THRESHOLD = 0.035

/** 彩度帯の上限（sRGB ガマット内では ~0.32 が最大） */
const MAX_CHROMA = 0.32

/** 全ピクセルに対する最小占有率 — これ未満のセルは最寄りに吸収 */
const MIN_CELL_RATIO = 0.003

// ─── 型 ───

export interface PalettePoint {
  readonly oklch: OklchValue
  readonly weight: number
}

export interface PaletteEntry {
  readonly centroid: OklchValue
  readonly memberIndices: number[]
  readonly totalWeight: number
}

// ─── ユーティリティ ───

/** OKLAB ΔEok² */
function deltaEokSq(a: OklchValue, b: OklchValue): number {
  const dL = a.lightness - b.lightness
  const aHrad = (a.hue * Math.PI) / 180
  const bHrad = (b.hue * Math.PI) / 180
  const da = a.chroma * Math.cos(aHrad) - b.chroma * Math.cos(bHrad)
  const db = a.chroma * Math.sin(aHrad) - b.chroma * Math.sin(bHrad)
  return dL * dL + da * da + db * db
}

/** 重みつき OKLCH 平均（hue は sin/cos 平均） */
function weightedMean(
  points: ReadonlyArray<PalettePoint>,
  indices: number[],
): OklchValue {
  let sumL = 0
  let sumA = 0
  let sumB = 0
  let totalW = 0

  for (const i of indices) {
    const p = points[i]!
    const w = p.weight
    const hRad = (p.oklch.hue * Math.PI) / 180
    sumL += p.oklch.lightness * w
    sumA += p.oklch.chroma * Math.cos(hRad) * w
    sumB += p.oklch.chroma * Math.sin(hRad) * w
    totalW += w
  }

  if (totalW === 0) return { lightness: 0, chroma: 0, hue: 0 }

  const avgL = sumL / totalW
  const avgA = sumA / totalW
  const avgB = sumB / totalW
  const chroma = Math.sqrt(avgA * avgA + avgB * avgB)
  let hue = (Math.atan2(avgB, avgA) * 180) / Math.PI
  if (hue < 0) hue += 360

  return { lightness: avgL, chroma, hue }
}

/** 最小距離ペアを探してマージする（1回分） */
function mergeClosestPair(entries: PaletteEntry[], points: ReadonlyArray<PalettePoint>): boolean {
  if (entries.length <= 1) return false

  let bestI = 0
  let bestJ = 1
  let bestDist = Infinity
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const d = deltaEokSq(entries[i]!.centroid, entries[j]!.centroid)
      if (d < bestDist) {
        bestDist = d
        bestI = i
        bestJ = j
      }
    }
  }

  const merged: number[] = [
    ...entries[bestI]!.memberIndices,
    ...entries[bestJ]!.memberIndices,
  ]
  const mergedWeight = entries[bestI]!.totalWeight + entries[bestJ]!.totalWeight
  entries[bestI] = {
    centroid: weightedMean(points, merged),
    memberIndices: merged,
    totalWeight: mergedWeight,
  }
  entries.splice(bestJ, 1)
  return true
}

// ─── メイン ───

/**
 * 画像のカラーパレットを抽出する。
 *
 * @param points サンプリング済みピクセル群
 * @param maxColors パレット色数の上限。0 = 自動決定。
 */
export function extractPalette(
  points: ReadonlyArray<PalettePoint>,
  maxColors: number = 0,
): PaletteEntry[] {
  if (points.length === 0) return []

  const hueStep = 360 / HUE_SEGMENTS
  const chromaStep = (MAX_CHROMA - ACHROMATIC_THRESHOLD) / CHROMA_BANDS

  // --- Step 1: 3D グリッドに振り分け ---
  const cells = new Map<string, number[]>()

  for (let i = 0; i < points.length; i++) {
    const { lightness, chroma, hue } = points[i]!.oklch

    const lBand = Math.min(
      Math.floor(lightness * LIGHTNESS_BANDS),
      LIGHTNESS_BANDS - 1,
    )

    let key: string
    if (chroma < ACHROMATIC_THRESHOLD) {
      key = `achro_l${lBand}`
    } else {
      const hSeg = Math.floor(((hue % 360) + 360) % 360 / hueStep)
      const cBand = Math.min(
        Math.floor((chroma - ACHROMATIC_THRESHOLD) / chromaStep),
        CHROMA_BANDS - 1,
      )
      key = `h${hSeg}_l${lBand}_c${cBand}`
    }

    let arr = cells.get(key)
    if (!arr) {
      arr = []
      cells.set(key, arr)
    }
    arr.push(i)
  }

  // --- Step 2: 各セルから PaletteEntry を生成 ---
  let entries: PaletteEntry[] = []
  let totalWeight = 0
  for (const [, indices] of cells) {
    if (indices.length === 0) continue
    let cellWeight = 0
    for (const i of indices) cellWeight += points[i]!.weight
    totalWeight += cellWeight
    entries.push({
      centroid: weightedMean(points, indices),
      memberIndices: indices,
      totalWeight: cellWeight,
    })
  }

  // --- Step 3: 占有率が極端に低いセルを最寄りに吸収 ---
  const minWeight = totalWeight * MIN_CELL_RATIO
  let changed = true
  while (changed) {
    changed = false
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]!.totalWeight >= minWeight) continue
      if (entries.length <= 1) break

      let bestJ = -1
      let bestDist = Infinity
      for (let j = 0; j < entries.length; j++) {
        if (j === i) continue
        const d = deltaEokSq(entries[i]!.centroid, entries[j]!.centroid)
        if (d < bestDist) {
          bestDist = d
          bestJ = j
        }
      }

      if (bestJ >= 0) {
        const target = entries[bestJ]!
        const merged: number[] = [...target.memberIndices, ...entries[i]!.memberIndices]
        entries[bestJ] = {
          centroid: weightedMean(points, merged),
          memberIndices: merged,
          totalWeight: target.totalWeight + entries[i]!.totalWeight,
        }
        entries.splice(i, 1)
        changed = true
      }
    }
  }

  // --- Step 4: maxColors が指定されていればその数までマージ ---
  if (maxColors > 0) {
    while (entries.length > maxColors) {
      if (!mergeClosestPair(entries, points)) break
    }
  }

  // --- Step 5: totalWeight 降順ソート ---
  entries.sort((a, b) => b.totalWeight - a.totalWeight)

  return entries
}
