import type { Result } from '@/core/result'
import { generateLightnessHistogram } from '@/infrastructure/lightnessHistogramGenerator'
import type { HistogramData, HistogramError } from '@/infrastructure/histogramTypes'

/**
 * 画像の明度（lightness）分布のヒストグラムデータを生成する。
 * @param imageData オリジナル画像のピクセルデータ
 */
export function generateLightnessHistogramUseCase(
  imageData: ImageData,
): Result<HistogramData, HistogramError> {
  return generateLightnessHistogram(imageData)
}
