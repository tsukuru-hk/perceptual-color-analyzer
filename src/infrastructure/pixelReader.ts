/**
 * ImageData から指定座標の sRGB (0-255) を取得。
 * Infrastructure: データアクセスのみ。
 */

import type { Result } from '@/core/result';
import { success, failure } from '@/core/result';
import { BaseError } from '@/core/result';

export type PixelReadError = 'OutOfBounds';

export interface RgbPixel {
  red: number;
  green: number;
  blue: number;
}

/**
 * @param imageData 対象の画像データ
 * @param pixelX ピクセルの X 座標
 * @param pixelY ピクセルの Y 座標
 */
export function getPixelAt(
  imageData: ImageData,
  pixelX: number,
  pixelY: number
): Result<RgbPixel, PixelReadError> {
  const { width, height, data } = imageData;
  if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) {
    return failure(
      new BaseError<PixelReadError>({
        name: 'OutOfBounds',
        message: `Pixel (${pixelX}, ${pixelY}) is out of bounds (${width}x${height})`,
      })
    );
  }
  const byteOffset = (pixelY * width + pixelX) * 4;
  return success({
    red: data[byteOffset]!,
    green: data[byteOffset + 1]!,
    blue: data[byteOffset + 2]!,
  });
}
