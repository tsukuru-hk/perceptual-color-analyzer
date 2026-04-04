/**
 * 明度 (OKLCH Lightness) のヒストグラムデータを生成する。
 * Infrastructure: ピクセルループと Culori 変換のみ。Canvas 非依存。
 */
import { type Result, success } from '@/core/result'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import { createPixelConverter } from '@/infrastructure/colorSpaceConverter'
import type { HistogramBin, HistogramData, HistogramError } from './histogramTypes'

/**
 * 画像の各ピクセルの OKLCH lightness 値を集計し、ヒストグラムデータを返す。
 * @param source 色空間情報付き入力画像
 * @param binCount ビン数 (デフォルト 256)
 */
export function generateLightnessHistogram(
  source: ColorAwareImageData,
  binCount: number = 256,
): Result<HistogramData, HistogramError> {
  const { data, width, height } = source.imageData
  const pixelCount = width * height
  const binWidth = 1 / binCount
  const counts = new Uint32Array(binCount)
  let opaquePixels = 0
  const toOklch = createPixelConverter(source.colorSpace)

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    if (data[offset + 3]! < 128) continue
    opaquePixels++
    const result = toOklch(data[offset]!, data[offset + 1]!, data[offset + 2]!)
    const l = result?.l ?? 0
    const idx = Math.min(Math.floor(l * binCount), binCount - 1)
    counts[idx]!++
  }

  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    rangeStart: i * binWidth,
    rangeEnd: (i + 1) * binWidth,
    count: counts[i]!,
  }))

  return success({ bins, totalPixels: opaquePixels, domain: [0, 1] })
}
