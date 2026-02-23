/**
 * 画像ファイルの読み込みと Canvas への描画。
 * Infrastructure: ブラウザ API（File, Canvas）に依存。
 */

import type { Result } from '@/core/result';
import { success, failure } from '@/core/result';
import { BaseError } from '@/core/result';

export type ImageLoadError = 'FileReadError' | 'CanvasError' | 'InvalidImage';

/**
 * File を読み込み、指定サイズの Canvas に描画して ImageData を返す。
 */
export async function loadImageToImageData(
  file: File,
  maxWidth: number,
  maxHeight: number
): Promise<Result<ImageData, ImageLoadError>> {
  const img = await loadFileAsImage(file);
  if (img.isFailure()) return img;
  return drawToCanvasAndGetImageData(img.value, maxWidth, maxHeight);
}

function loadFileAsImage(
  file: File
): Promise<Result<HTMLImageElement, ImageLoadError>> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(success(img));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(
        failure(
          new BaseError<ImageLoadError>({
            name: 'InvalidImage',
            message: `Failed to decode image: ${file.name}`,
          })
        )
      );
    };
    img.src = url;
  });
}

function drawToCanvasAndGetImageData(
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number
): Result<ImageData, ImageLoadError> {
  const canvas = document.createElement('canvas');
  const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
  canvas.width = Math.floor(img.width * scale);
  canvas.height = Math.floor(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return failure(
      new BaseError<ImageLoadError>({
        name: 'CanvasError',
        message: 'Could not get 2d context',
      })
    );
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return success(imageData);
  } catch (e) {
    return failure(
      new BaseError<ImageLoadError>({
        name: 'CanvasError',
        message: e instanceof Error ? e.message : 'getImageData failed',
        cause: e,
      })
    );
  }
}
