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
 * (pixelX, pixelY) のピクセルを OKLCH に変換する。
 * sRGB は 0-255、Culori は 0-1 なので変換してから oklch() に渡す。
 * @param imageData 対象の画像データ
 * @param pixelX ピクセルの X 座標
 * @param pixelY ピクセルの Y 座標
 */
export function getPixelOklchUseCase(
  imageData: ImageData,
  pixelX: number,
  pixelY: number
): Result<OklchValue, GetPixelOklchError> {
  const pixelResult = getPixelAt(imageData, pixelX, pixelY);
  if (pixelResult.isFailure()) return pixelResult;

  const { red, green, blue } = pixelResult.value;
  const hex = formatHex({
    mode: 'rgb',
    r: red / 255,
    g: green / 255,
    b: blue / 255,
  });
  const oklchColor = oklch(hex);
  if (!oklchColor || oklchColor.mode !== 'oklch') {
    return failure(
      new BaseError<GetPixelOklchError>({
        name: 'ConversionError',
        message: `Could not convert pixel (${pixelX}, ${pixelY}) to OKLCH`,
      })
    );
  }
  // Culori の oklch は l, c, h で、c が chroma。h は度数または undefined（無彩色）
  const lightness = oklchColor.l ?? 0;
  const chroma = oklchColor.c ?? 0;
  const hue = oklchColor.h ?? 0;
  return success(createOklch(lightness, chroma, hue));
}
