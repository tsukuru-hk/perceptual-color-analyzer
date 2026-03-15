import type { Result } from '@/core/result'
import { generateChromaMap, type ChromaMapError } from '@/infrastructure/chromaMapGenerator'

/**
 * 画像の彩度（chroma）に基づくグレースケールマップを生成する。
 */
export function generateChromaMapUseCase(
  imageData: ImageData,
): Result<ImageData, ChromaMapError> {
  return generateChromaMap(imageData)
}
