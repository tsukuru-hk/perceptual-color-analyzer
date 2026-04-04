import type { Result } from '@/core/result'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import { generateLightnessHistogram } from '@/infrastructure/lightnessHistogramGenerator'
import type { HistogramData, HistogramError } from '@/infrastructure/histogramTypes'

/**
 * 画像の明度（lightness）分布のヒストグラムデータを生成する。
 * @param source 色空間情報付き入力画像
 */
export function generateLightnessHistogramUseCase(
  source: ColorAwareImageData,
): Result<HistogramData, HistogramError> {
  return generateLightnessHistogram(source)
}
