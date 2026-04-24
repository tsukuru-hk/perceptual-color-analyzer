/**
 * 色相分析 (Hue Analysis) ジェネレーター。
 * 極座標ローズダイアグラム + 密度ガマットシェイプのデータを生成する。
 * Infrastructure: ピクセルループと Culori 変換のみ。Canvas 非依存。
 */
import { type Result, success } from '@/core/result'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import { createPixelConverter } from '@/infrastructure/colorSpaceConverter'
import { converter, clampChroma, displayable } from 'culori'
import type {
  HueAnalysisResult,
  HueSector,
  PolarDensityCell,
  LightnessBandData,
  Rgb as RgbType,
} from '@/types/hueAnalysis'

export type HueAnalysisError = 'ConversionError' | 'NoPixels'

const HUE_BIN_COUNT = 72
const CHROMA_BIN_COUNT = 24
const HUE_BIN_WIDTH = 360 / HUE_BIN_COUNT // 15°

/** 無彩色とみなす RGB 最大差の閾値 */
const RGB_ACHROMATIC_THRESHOLD = 2

/** 明度帯の定義 */
const LIGHTNESS_BANDS = [
  { label: 'dark' as const, range: [0, 0.35] as [number, number] },
  { label: 'mid' as const, range: [0.35, 0.65] as [number, number] },
  { label: 'light' as const, range: [0.65, 1.0] as [number, number] },
]

const toRgb = converter('rgb')

/** OKLCH → sRGB (0-255)。ガマット外は clampChroma でクランプ */
function oklchToRgb255(l: number, c: number, h: number): RgbType {
  const clamped = clampChroma({ mode: 'oklch', l, c, h }, 'oklch')
  const rgb = toRgb(clamped) as { r?: number; g?: number; b?: number } | undefined
  return {
    r: Math.round(Math.max(0, Math.min(255, (rgb?.r ?? 0.5) * 255))),
    g: Math.round(Math.max(0, Math.min(255, (rgb?.g ?? 0.5) * 255))),
    b: Math.round(Math.max(0, Math.min(255, (rgb?.b ?? 0.5) * 255))),
  }
}

/** 指定色相(L=0.65)での sRGB ガマット最大彩度を二分探索 */
function findMaxChromaForHue(hue: number): number {
  let lo = 0
  let hi = 0.4
  while (hi - lo > 0.001) {
    const mid = (lo + hi) / 2
    if (displayable({ mode: 'oklch', l: 0.65, c: mid, h: hue })) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return lo
}

/** 密度グリッド (hueBins × chromaBins) のカウント配列 */
interface GridAccumulator {
  counts: Uint32Array
  totalPixels: number
}

function createGrid(): GridAccumulator {
  return {
    counts: new Uint32Array(HUE_BIN_COUNT * CHROMA_BIN_COUNT),
    totalPixels: 0,
  }
}

/** グリッドからセクターを生成 */
function buildSectors(grid: GridAccumulator): HueSector[] {
  const sectors: HueSector[] = []
  for (let h = 0; h < HUE_BIN_COUNT; h++) {
    let count = 0
    for (let c = 0; c < CHROMA_BIN_COUNT; c++) {
      count += grid.counts[h * CHROMA_BIN_COUNT + c]!
    }
    const hueStart = h * HUE_BIN_WIDTH
    const hueEnd = hueStart + HUE_BIN_WIDTH
    const hueCenter = hueStart + HUE_BIN_WIDTH / 2
    sectors.push({
      hueStart,
      hueEnd,
      ratio: grid.totalPixels > 0 ? count / grid.totalPixels : 0,
      count,
      fillRgb: oklchToRgb255(0.7, 0.15, hueCenter),
    })
  }
  return sectors
}

/** グリッドから密度セルを生成（count > 0 のセルのみ） */
function buildDensityCells(grid: GridAccumulator, maxChroma: number): PolarDensityCell[] {
  const chromaBinWidth = maxChroma / CHROMA_BIN_COUNT
  const nonEmptyCells: { hueBin: number; chromaBin: number; count: number }[] = []
  let maxCount = 0

  for (let h = 0; h < HUE_BIN_COUNT; h++) {
    for (let c = 0; c < CHROMA_BIN_COUNT; c++) {
      const count = grid.counts[h * CHROMA_BIN_COUNT + c]!
      if (count > 0) {
        nonEmptyCells.push({ hueBin: h, chromaBin: c, count })
        if (count > maxCount) maxCount = count
      }
    }
  }

  // count 降順ソートして累積パーセンタイルを計算
  const sorted = [...nonEmptyCells].sort((a, b) => b.count - a.count)
  const percentileMap = new Map<string, number>()
  let accumulated = 0
  for (const cell of sorted) {
    accumulated += cell.count
    percentileMap.set(`${cell.hueBin},${cell.chromaBin}`, accumulated / grid.totalPixels)
  }

  return nonEmptyCells.map((cell) => {
    const hueCenter = cell.hueBin * HUE_BIN_WIDTH + HUE_BIN_WIDTH / 2
    const chromaCenter = cell.chromaBin * chromaBinWidth + chromaBinWidth / 2
    return {
      hueBin: cell.hueBin,
      chromaBin: cell.chromaBin,
      hueCenter,
      chromaCenter,
      density: maxCount > 0 ? cell.count / maxCount : 0,
      cumulativePercentile: percentileMap.get(`${cell.hueBin},${cell.chromaBin}`) ?? 1,
      fillRgb: oklchToRgb255(0.65, chromaCenter, hueCenter),
    }
  })
}

/**
 * 画像の色相分析データを生成する。
 * @param source 色空間情報付き入力画像
 */
export function generateHueAnalysis(
  source: ColorAwareImageData,
): Result<HueAnalysisResult, HueAnalysisError> {
  const { data, width, height } = source.imageData
  const pixelCount = width * height
  const toOklch = createPixelConverter(source.colorSpace)

  // 4つのグリッド: all + dark/mid/light
  const allGrid = createGrid()
  const bandGrids = LIGHTNESS_BANDS.map(() => createGrid())

  let maxChroma = 0
  let opaquePixels = 0

  // バンドマスク: 0=dark, 1=mid, 2=light, 255=透明/無彩色
  const bandMask = new Uint8Array(pixelCount)
  bandMask.fill(255)

  // === 1パスでピクセルを走査 ===
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    if (data[offset + 3]! < 128) continue
    opaquePixels++

    const r = data[offset]!, g = data[offset + 1]!, b = data[offset + 2]!
    // 無彩色チェック
    if (Math.max(r, g, b) - Math.min(r, g, b) <= RGB_ACHROMATIC_THRESHOLD) continue

    const result = toOklch(r, g, b)
    if (!result) continue

    if (result.c < 0.01) continue // 低彩度は無視

    if (result.c > maxChroma) maxChroma = result.c

    // all グリッド
    allGrid.totalPixels++

    // 明度帯グリッド + バンドマスク
    for (let bi = 0; bi < LIGHTNESS_BANDS.length; bi++) {
      const band = LIGHTNESS_BANDS[bi]!
      if (result.l >= band.range[0] && result.l < band.range[1]) {
        bandGrids[bi]!.totalPixels++
        bandMask[i] = bi // 0=dark, 1=mid, 2=light
        break
      }
    }

    // chroma ビンは maxChroma 確定前に正確に計算できないため、
    // 生データを保持して2パス目で割り振る必要がある
    // → パフォーマンスのため中間バッファに保存
    // ただし大きな画像でメモリが問題になる可能性があるため、
    // 代替として maxChroma を先にプリスキャンする
  }

  if (allGrid.totalPixels === 0) {
    // 有彩色ピクセルなし → 空の結果を返す（3D表示は維持）
    const emptySectors = buildSectors(allGrid)
    const emptyDensityCells: PolarDensityCell[] = []
    const emptyGamutMaxChroma: number[] = []
    const emptyRingColors: RgbType[] = []
    const emptyWheelColors: RgbType[] = []
    const defaultMaxChroma = 0.4
    const defaultChromaBinWidth = defaultMaxChroma / CHROMA_BIN_COUNT
    for (let h = 0; h < HUE_BIN_COUNT; h++) {
      const hueCenter = h * HUE_BIN_WIDTH + HUE_BIN_WIDTH / 2
      emptyGamutMaxChroma.push(findMaxChromaForHue(hueCenter))
      emptyRingColors.push(oklchToRgb255(0.65, emptyGamutMaxChroma[h]! * 0.95, hueCenter))
      for (let c = 0; c < CHROMA_BIN_COUNT; c++) {
        const chromaCenter = c * defaultChromaBinWidth + defaultChromaBinWidth / 2
        emptyWheelColors.push(oklchToRgb255(0.65, chromaCenter, hueCenter))
      }
    }
    const emptyLightnessBands: LightnessBandData[] = LIGHTNESS_BANDS.map((band, i) => ({
      label: band.label,
      range: band.range,
      sectors: buildSectors(bandGrids[i]!),
      densityCells: [],
      pixelCount: 0,
    }))
    return success({
      sectors: emptySectors,
      densityCells: emptyDensityCells,
      hueBinCount: HUE_BIN_COUNT,
      chromaBinCount: CHROMA_BIN_COUNT,
      maxChroma: 0.4,
      gamutMaxChroma: emptyGamutMaxChroma,
      ringColors: emptyRingColors,
      wheelColors: emptyWheelColors,
      lightnessBands: emptyLightnessBands,
      totalChromaticPixels: 0,
      totalOpaquePixels: opaquePixels,
      bandMask,
    })
  }

  // === maxChroma が確定したので、2パス目で正確なビン割り当て ===
  // リセット
  allGrid.counts.fill(0)
  for (const bg of bandGrids) bg.counts.fill(0)
  const chromaBinWidth = maxChroma / CHROMA_BIN_COUNT

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    if (data[offset + 3]! < 128) continue

    const r = data[offset]!, g = data[offset + 1]!, b = data[offset + 2]!
    if (Math.max(r, g, b) - Math.min(r, g, b) <= RGB_ACHROMATIC_THRESHOLD) continue

    const result = toOklch(r, g, b)
    if (!result) continue

    const { l, c, h } = result
    if (c < 0.01) continue

    const hueBin = Math.min(Math.floor(h / HUE_BIN_WIDTH), HUE_BIN_COUNT - 1)
    const chromaBin = Math.min(Math.floor(c / chromaBinWidth), CHROMA_BIN_COUNT - 1)
    const idx = hueBin * CHROMA_BIN_COUNT + chromaBin

    allGrid.counts[idx]!++

    for (let bi = 0; bi < LIGHTNESS_BANDS.length; bi++) {
      const band = LIGHTNESS_BANDS[bi]!
      if (l >= band.range[0] && l < band.range[1]) {
        bandGrids[bi]!.counts[idx]!++
        break
      }
    }
  }

  // === 結果を構築 ===
  const sectors = buildSectors(allGrid)
  const densityCells = buildDensityCells(allGrid, maxChroma)

  // 各色相のガマット最大彩度を計算
  const gamutMaxChroma: number[] = []
  for (let h = 0; h < HUE_BIN_COUNT; h++) {
    const hueCenter = h * HUE_BIN_WIDTH + HUE_BIN_WIDTH / 2
    gamutMaxChroma.push(findMaxChromaForHue(hueCenter))
  }

  // 色相環リング用の高彩度色（各色相のガマット最大彩度で生成）
  const ringColors: RgbType[] = []
  for (let h = 0; h < HUE_BIN_COUNT; h++) {
    const hueCenter = h * HUE_BIN_WIDTH + HUE_BIN_WIDTH / 2
    ringColors.push(oklchToRgb255(0.65, gamutMaxChroma[h]! * 0.95, hueCenter))
  }

  // カラーホイール全セルの色を事前計算
  const wheelColors: RgbType[] = []
  const chromaBinWidthFinal = maxChroma / CHROMA_BIN_COUNT
  for (let h = 0; h < HUE_BIN_COUNT; h++) {
    const hueCenter = h * HUE_BIN_WIDTH + HUE_BIN_WIDTH / 2
    for (let c = 0; c < CHROMA_BIN_COUNT; c++) {
      const chromaCenter = c * chromaBinWidthFinal + chromaBinWidthFinal / 2
      wheelColors.push(oklchToRgb255(0.65, chromaCenter, hueCenter))
    }
  }

  const lightnessBands: LightnessBandData[] = LIGHTNESS_BANDS.map((band, i) => ({
    label: band.label,
    range: band.range,
    sectors: buildSectors(bandGrids[i]!),
    densityCells: buildDensityCells(bandGrids[i]!, maxChroma),
    pixelCount: bandGrids[i]!.totalPixels,
  }))

  return success({
    sectors,
    densityCells,
    hueBinCount: HUE_BIN_COUNT,
    chromaBinCount: CHROMA_BIN_COUNT,
    maxChroma,
    gamutMaxChroma,
    ringColors,
    wheelColors,
    lightnessBands,
    totalChromaticPixels: allGrid.totalPixels,
    totalOpaquePixels: opaquePixels,
    bandMask,
  })
}
