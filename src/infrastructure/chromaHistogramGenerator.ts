/**
 * 彩度 (OKLCH Chroma) のヒストグラムデータを生成する。
 * Infrastructure: ピクセルループと Culori 変換のみ。Canvas 非依存。
 */
import { oklch } from 'culori'
import { type Result, success } from '@/core/result'
import type { HistogramBin, HistogramData, HistogramError } from './histogramTypes'

/**
 * 画像の各ピクセルの OKLCH chroma 値を集計し、ヒストグラムデータを返す。
 * @param imageData 入力のラスタ画像
 * @param binCount ビン数 (デフォルト 256)
 */
export function generateChromaHistogram(
  imageData: ImageData,
  binCount: number = 256,
): Result<HistogramData, HistogramError> {
  const { data, width, height } = imageData
  const pixelCount = width * height
  const chromaValues = new Float32Array(pixelCount)
  let maxChroma = 0

  // 1st pass: 各ピクセルの chroma を取得し、最大値を追跡
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    const r = data[offset]! / 255
    const g = data[offset + 1]! / 255
    const b = data[offset + 2]! / 255

    const result = oklch({ mode: 'rgb', r, g, b })
    const c = result?.c ?? 0
    chromaValues[i] = c
    if (c > maxChroma) maxChroma = c
  }

  // 完全に無彩色の画像
  if (maxChroma === 0) {
    const bins: HistogramBin[] = [{ rangeStart: 0, rangeEnd: 0, count: pixelCount }]
    return success({ bins, totalPixels: pixelCount, domain: [0, 0] })
  }

  // ビンを初期化
  const binWidth = maxChroma / binCount
  const counts = new Uint32Array(binCount)

  // 2nd pass: 各 chroma 値をビンに振り分け
  for (let i = 0; i < pixelCount; i++) {
    const idx = Math.min(Math.floor(chromaValues[i]! / binWidth), binCount - 1)
    counts[idx]!++
  }

  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    rangeStart: i * binWidth,
    rangeEnd: (i + 1) * binWidth,
    count: counts[i]!,
  }))

  return success({ bins, totalPixels: pixelCount, domain: [0, maxChroma] })
}
