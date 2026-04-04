/**
 * 明度 (OKLCH Lightness) のヒストグラムデータを生成する。
 * Infrastructure: ピクセルループと Culori 変換のみ。Canvas 非依存。
 */
import { oklch } from 'culori'
import { type Result, success } from '@/core/result'
import type { HistogramBin, HistogramData, HistogramError } from './histogramTypes'

/**
 * 画像の各ピクセルの OKLCH lightness 値を集計し、ヒストグラムデータを返す。
 * @param imageData 入力のラスタ画像
 * @param binCount ビン数 (デフォルト 256)
 */
export function generateLightnessHistogram(
  imageData: ImageData,
  binCount: number = 256,
): Result<HistogramData, HistogramError> {
  const { data, width, height } = imageData
  const pixelCount = width * height
  const binWidth = 1 / binCount
  const counts = new Uint32Array(binCount)

  // Single pass: 各ピクセルの lightness を取得してビンに振り分け
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    const r = data[offset]! / 255
    const g = data[offset + 1]! / 255
    const b = data[offset + 2]! / 255

    const result = oklch({ mode: 'rgb', r, g, b })
    const l = result?.l ?? 0
    const idx = Math.min(Math.floor(l * binCount), binCount - 1)
    counts[idx]!++
  }

  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    rangeStart: i * binWidth,
    rangeEnd: (i + 1) * binWidth,
    count: counts[i]!,
  }))

  return success({ bins, totalPixels: pixelCount, domain: [0, 1] })
}
