import type { Result } from '@/core/result'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import { generateLightnessMap, type LightnessMapError } from '@/infrastructure/lightnessMapGenerator'

/**
 * 画像の明度（lightness）に基づくグレースケールマップを生成する。
 * @param source 色空間情報付き入力画像
 */
export function generateLightnessMapUseCase(
  source: ColorAwareImageData,
): Result<ImageData, LightnessMapError> {
  return generateLightnessMap(source)
}
