/**
 * 指定色空間のガマット境界（各 L, H での最大 Chroma）を算出する。
 * Infrastructure: Culori の displayable / inGamut に依存。
 */
import { displayable, inGamut } from 'culori'
import type { ColorSpace } from '@/domain/colorSpace'

/** ガマット境界データ: L × H グリッドでの最大 Chroma 値 */
export interface GamutBoundaryData {
  /** Lightness レベル配列 (0–1) */
  readonly lightnessLevels: readonly number[]
  /** Hue ステップ配列 (0–360) */
  readonly hueSteps: readonly number[]
  /** maxChroma[liIndex][hiIndex] — 各 (L, H) での最大 Chroma */
  readonly maxChroma: readonly (readonly number[])[]
}

/** 二分探索の精度 */
const CHROMA_PRECISION = 0.001
/** 探索の上限 Chroma */
const CHROMA_UPPER_BOUND = 0.4

/**
 * 指定色空間での (L, H) における最大 Chroma を二分探索で算出する。
 */
function findMaxChroma(
  l: number,
  h: number,
  isInGamut: (color: { mode: 'oklch'; l: number; c: number; h: number }) => boolean,
): number {
  let lo = 0
  let hi = CHROMA_UPPER_BOUND

  while (hi - lo > CHROMA_PRECISION) {
    const mid = (lo + hi) / 2
    if (isInGamut({ mode: 'oklch', l, c: mid, h })) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return lo
}

/**
 * 指定色空間のガマット境界をグリッド状に計算する。
 *
 * @param colorSpace 対象色空間
 * @param lightnessSteps Lightness の分割数 (デフォルト: 16)
 * @param hueSteps Hue の分割数 (デフォルト: 36)
 */
export function computeGamutBoundary(
  colorSpace: ColorSpace,
  lightnessSteps: number = 16,
  hueSteps: number = 36,
): GamutBoundaryData {
  // sRGB → displayable(), display-p3 → inGamut('p3')
  const isInGamut: (color: { mode: 'oklch'; l: number; c: number; h: number }) => boolean =
    colorSpace === 'display-p3'
      ? (inGamut('p3') as (color: { mode: 'oklch'; l: number; c: number; h: number }) => boolean)
      : (c) => displayable(c)

  const lightnessLevels: number[] = []
  for (let li = 0; li <= lightnessSteps; li++) {
    lightnessLevels.push(li / lightnessSteps)
  }

  const hueValues: number[] = []
  for (let hi = 0; hi < hueSteps; hi++) {
    hueValues.push((hi / hueSteps) * 360)
  }

  const maxChroma: number[][] = []
  for (const l of lightnessLevels) {
    const row: number[] = []
    for (const h of hueValues) {
      row.push(findMaxChroma(l, h, isInGamut))
    }
    maxChroma.push(row)
  }

  return {
    lightnessLevels,
    hueSteps: hueValues,
    maxChroma,
  }
}
