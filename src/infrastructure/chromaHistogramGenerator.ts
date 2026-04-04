/**
 * 彩度 (OKLCH Chroma) のヒストグラムデータを生成する。
 * Infrastructure: ピクセルループと Culori 変換のみ。Canvas 非依存。
 */
import { type Result, success } from '@/core/result'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import { createPixelConverter } from '@/infrastructure/colorSpaceConverter'
import type { HistogramBin, HistogramData, HistogramError } from './histogramTypes'

/**
 * 画像の各ピクセルの OKLCH chroma 値を集計し、ヒストグラムデータを返す。
 * @param source 色空間情報付き入力画像
 * @param binCount ビン数 (デフォルト 256)
 */
export function generateChromaHistogram(
  source: ColorAwareImageData,
  binCount: number = 256,
): Result<HistogramData, HistogramError> {
  const { data, width, height } = source.imageData
  const pixelCount = width * height
  const chromaValues = new Float32Array(pixelCount)
  const opaqueFlags = new Uint8Array(pixelCount)
  let maxChroma = 0
  let opaquePixels = 0
  const toOklch = createPixelConverter(source.colorSpace)

  /**
   * 8ビット RGB の量子化ノイズを無彩色と見なす閾値。
   * RGB 各チャンネルの最大差がこの値以下のピクセルは chroma = 0 として扱う。
   */
  const RGB_ACHROMATIC_THRESHOLD = 2

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    if (data[offset + 3]! < 128) continue
    opaqueFlags[i] = 1
    opaquePixels++
    const r = data[offset]!, g = data[offset + 1]!, b = data[offset + 2]!
    if (Math.max(r, g, b) - Math.min(r, g, b) <= RGB_ACHROMATIC_THRESHOLD) continue
    const result = toOklch(r, g, b)
    const c = result?.c ?? 0
    chromaValues[i] = c
    if (c > maxChroma) maxChroma = c
  }

  if (maxChroma === 0) {
    const bins: HistogramBin[] = [{ rangeStart: 0, rangeEnd: 0, count: opaquePixels }]
    return success({ bins, totalPixels: opaquePixels, domain: [0, 0] })
  }

  const binWidth = maxChroma / binCount
  const counts = new Uint32Array(binCount)

  for (let i = 0; i < pixelCount; i++) {
    if (!opaqueFlags[i]) continue
    const idx = Math.min(Math.floor(chromaValues[i]! / binWidth), binCount - 1)
    counts[idx]!++
  }

  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    rangeStart: i * binWidth,
    rangeEnd: (i + 1) * binWidth,
    count: counts[i]!,
  }))

  return success({ bins, totalPixels: opaquePixels, domain: [0, maxChroma] })
}
