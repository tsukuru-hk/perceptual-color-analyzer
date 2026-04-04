import type { Result } from '@/core/result'
import { generateLightnessMap, type LightnessMapError } from '@/infrastructure/lightnessMapGenerator'

/**
 * 画像の明度（lightness）に基づくグレースケールマップを生成する。
 * @param imageData オリジナル画像のピクセルデータ
 */
export function generateLightnessMapUseCase(
  imageData: ImageData,
): Result<ImageData, LightnessMapError> {
  return generateLightnessMap(imageData)
}
