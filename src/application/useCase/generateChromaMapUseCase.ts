import type { Result } from '@/core/result'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import { generateChromaMap, type ChromaMapError } from '@/infrastructure/chromaMapGenerator'

/**
 * 画像の彩度（chroma）に基づくグレースケールマップを生成する。
 * @param source 色空間情報付き入力画像
 */
export function generateChromaMapUseCase(
  source: ColorAwareImageData,
): Result<ImageData, ChromaMapError> {
  return generateChromaMap(source)
}
