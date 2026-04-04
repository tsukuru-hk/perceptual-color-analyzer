import type { Result } from '@/core/result'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import { generateChromaHistogram } from '@/infrastructure/chromaHistogramGenerator'
import type { HistogramData, HistogramError } from '@/infrastructure/histogramTypes'

/**
 * 画像の彩度（chroma）分布のヒストグラムデータを生成する。
 * @param source 色空間情報付き入力画像
 */
export function generateChromaHistogramUseCase(
  source: ColorAwareImageData,
): Result<HistogramData, HistogramError> {
  return generateChromaHistogram(source)
}
