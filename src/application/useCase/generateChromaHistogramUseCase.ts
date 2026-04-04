import type { Result } from '@/core/result'
import { generateChromaHistogram } from '@/infrastructure/chromaHistogramGenerator'
import type { HistogramData, HistogramError } from '@/infrastructure/histogramTypes'

/**
 * 画像の彩度（chroma）分布のヒストグラムデータを生成する。
 * @param imageData オリジナル画像のピクセルデータ
 */
export function generateChromaHistogramUseCase(
  imageData: ImageData,
): Result<HistogramData, HistogramError> {
  return generateChromaHistogram(imageData)
}
