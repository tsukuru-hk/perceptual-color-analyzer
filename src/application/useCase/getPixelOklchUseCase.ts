/**
 * ImageData の指定ピクセルを sRGB から OKLCH に変換して返すユースケース。
 * Application層: インフラ（ピクセル取得）と Culori（変換）を組み合わせる。
 */

import { oklch, formatHex } from 'culori';
import type { Result } from '@/core/result';
import { success, failure } from '@/core/result';
import { BaseError } from '@/core/result';
import type { OklchValue } from '@/domain/oklch';
import { createOklch } from '@/domain/oklch';
import { getPixelAt } from '@/infrastructure/pixelReader';
import type { PixelReadError } from '@/infrastructure/pixelReader';

export type GetPixelOklchError = PixelReadError | 'ConversionError';

/**
 * (x, y) のピクセルを OKLCH に変換する。
 * sRGB は 0-255、Culori は 0-1 なので変換してから oklch() に渡す。
 */
export function getPixelOklchUseCase(
  imageData: ImageData,
  x: number,
  y: number
): Result<OklchValue, GetPixelOklchError> {
  const pixelResult = getPixelAt(imageData, x, y);
  if (pixelResult.isFailure()) return pixelResult;

  const { r, g, b } = pixelResult.value;
  const hex = formatHex({
    mode: 'rgb',
    r: r / 255,
    g: g / 255,
    b: b / 255,
  });
  const oklchColor = oklch(hex);
  if (!oklchColor || oklchColor.mode !== 'oklch') {
    return failure(
      new BaseError<GetPixelOklchError>({
        name: 'ConversionError',
        message: `Could not convert pixel (${x}, ${y}) to OKLCH`,
      })
    );
  }
  // Culori の oklch は L, c, h で、c が chroma。h は度数または undefined（無彩色）
  const L = oklchColor.l ?? 0;
  const C = oklchColor.c ?? 0;
  const h = oklchColor.h ?? 0;
  return success(createOklch(L, C, h));
}
