/**
 * ImageData から指定座標の sRGB (0-255) を取得。
 * Infrastructure: データアクセスのみ。
 */

import type { Result } from '@/core/result';
import { success, failure } from '@/core/result';
import { BaseError } from '@/core/result';

export type PixelReadError = 'OutOfBounds';

export interface RgbPixel {
  r: number;
  g: number;
  b: number;
}

export function getPixelAt(
  imageData: ImageData,
  x: number,
  y: number
): Result<RgbPixel, PixelReadError> {
  const { width, height, data } = imageData;
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return failure(
      new BaseError<PixelReadError>({
        name: 'OutOfBounds',
        message: `Pixel (${x}, ${y}) is out of bounds (${width}x${height})`,
      })
    );
  }
  const i = (y * width + x) * 4;
  return success({
    r: data[i]!,
    g: data[i + 1]!,
    b: data[i + 2]!,
  });
}
