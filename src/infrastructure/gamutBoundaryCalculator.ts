/**
 * 指定色空間のガマット境界（各 L, H での最大 Chroma）を算出する。
 * Infrastructure: Culori の displayable / inGamut に依存。
 */
import { displayable, inGamut, oklch } from 'culori'
import type { ColorSpace, WireframeGamut } from '@/domain/colorSpace'

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
/** 探索の上限 Chroma（Rec.2020 のグリーンで約 0.468 に達するため余裕を持たせる） */
const CHROMA_UPPER_BOUND = 0.5

type OklchColor = { mode: 'oklch'; l: number; c: number; h: number }

/**
 * 指定色空間に対応するガマット内判定関数を返す。
 */
function getGamutChecker(colorSpace: ColorSpace | WireframeGamut): (color: OklchColor) => boolean {
  const gamutCheckers: Record<string, (color: OklchColor) => boolean> = {
    'srgb': (c) => displayable(c),
    'display-p3': inGamut('p3') as (color: OklchColor) => boolean,
    'rec2020': inGamut('rec2020') as (color: OklchColor) => boolean,
    // 実験モード: 境界は sRGB で求める（縦軸だけ Rec.601 luma に取り直す）
    'lch-rec601': (c) => displayable(c),
  }
  return gamutCheckers[colorSpace] ?? gamutCheckers['srgb']!
}

/** Culori のカラーモード（原色 hue 算出に使用） */
type CuloriMode = 'rgb' | 'p3' | 'rec2020'

/** 色空間 → Culori モード。lch-rec601 は境界を sRGB で取るため rgb 扱い。 */
function toCuloriMode(colorSpace: ColorSpace | WireframeGamut): CuloriMode {
  switch (colorSpace) {
    case 'display-p3':
      return 'p3'
    case 'rec2020':
      return 'rec2020'
    default:
      return 'rgb'
  }
}

/** RGB キューブの原色・二次色（R Y G C B M）の単位頂点 */
const PRIMARY_CORNERS: readonly (readonly [number, number, number])[] = [
  [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1], [1, 0, 1],
]

/**
 * 対象色空間の原色・二次色の OKLCH 色相（0–360）を返す。
 *
 * ガマットの鋭いカスプ（青・赤などの角）はこれらの色相に立つため、
 * ワイヤーフレームの色相グリッドにこの角度を足しておくと、格子線をまたいで
 * 面が角を大きく切り落とす見た目を抑えられる。
 */
function getPrimaryHues(colorSpace: ColorSpace | WireframeGamut): number[] {
  const mode = toCuloriMode(colorSpace)
  const hues: number[] = []
  for (const [r, g, b] of PRIMARY_CORNERS) {
    // rec2020 等はランタイム登録済みだが Culori の入力型に含まれないためキャスト
    const c = oklch({ mode, r, g, b } as Parameters<typeof oklch>[0])
    if (c && c.h !== undefined) hues.push(((c.h % 360) + 360) % 360)
  }
  return hues
}

/**
 * 等間隔 hue に原色 hue を差し込み、昇順・重複排除した配列を返す。
 * 既存の hue と `mergeEpsilon` 度以内に重なる原色 hue は、退化した細い面を
 * 生まないよう既存側に寄せて捨てる。
 */
function mergeHues(base: number[], extra: number[], mergeEpsilon = 1.5): number[] {
  const merged = [...base]
  for (const h of extra) {
    if (merged.every((b) => Math.abs(b - h) > mergeEpsilon)) merged.push(h)
  }
  return merged.sort((a, b) => a - b)
}

/**
 * 指定色空間での (L, H) における最大 Chroma を二分探索で算出する。
 */
function findMaxChroma(
  l: number,
  h: number,
  isInGamut: (color: OklchColor) => boolean,
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
  colorSpace: ColorSpace | WireframeGamut,
  lightnessSteps: number = 16,
  hueSteps: number = 36,
): GamutBoundaryData {
  const isInGamut = getGamutChecker(colorSpace)

  const lightnessLevels: number[] = []
  for (let li = 0; li <= lightnessSteps; li++) {
    lightnessLevels.push(li / lightnessSteps)
  }

  const evenHues: number[] = []
  for (let hi = 0; hi < hueSteps; hi++) {
    evenHues.push((hi / hueSteps) * 360)
  }
  // 原色・二次色の鋭い角を頂点として拾えるよう、その色相を差し込む
  const hueValues = mergeHues(evenHues, getPrimaryHues(colorSpace))

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

/** 最大彩度カスプ点: ある Hue で全 L を走査したときの最大 Chroma とその位置 */
export interface CuspPoint {
  /** Hue (0–360) */
  readonly h: number
  /** 最大 Chroma を与える Lightness (0–1) */
  readonly l: number
  /** その Hue での最大 Chroma */
  readonly c: number
}

/**
 * 各 Hue における最大彩度（カスプ）の軌跡を算出する。
 *
 * 各 Hue で Lightness を細かく走査し、最大 Chroma を与える (L, C) を採用する。
 * 「最高彩度の色を繋げた線」の 3D 軌道を得るための関数。
 *
 * @param colorSpace 対象色空間（境界の求め方を決める）
 * @param hueSteps Hue の分割数 (デフォルト: 180 → 2° 刻み)
 * @param lightnessSamples Lightness の走査分割数 (デフォルト: 96)
 */
export function computeMaxChromaCusp(
  colorSpace: ColorSpace | WireframeGamut,
  hueSteps: number = 180,
  lightnessSamples: number = 96,
): CuspPoint[] {
  const isInGamut = getGamutChecker(colorSpace)
  const cusps: CuspPoint[] = []

  for (let hi = 0; hi < hueSteps; hi++) {
    const h = (hi / hueSteps) * 360
    let bestC = 0
    let bestL = 0.5
    // L=0, L=1 は Chroma=0 なので内側のみ走査
    for (let li = 1; li < lightnessSamples; li++) {
      const l = li / lightnessSamples
      const c = findMaxChroma(l, h, isInGamut)
      if (c > bestC) {
        bestC = c
        bestL = l
      }
    }
    cusps.push({ h, l: bestL, c: bestC })
  }

  return cusps
}
