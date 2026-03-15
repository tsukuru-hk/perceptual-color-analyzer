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
 * @param file 画像ファイル
 * @param maxWidth 描画先の最大幅 (px)
 * @param maxHeight 描画先の最大高さ (px)
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

/** @param file 読み込む画像ファイル */
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

/**
 * @param img デコード済みの画像要素
 * @param maxWidth 最大幅 (px)
 * @param maxHeight 最大高さ (px)
 */
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
  } catch (error) {
    return failure(
      new BaseError<ImageLoadError>({
        name: 'CanvasError',
        message: error instanceof Error ? error.message : 'getImageData failed',
        cause: error,
      })
    );
  }
}
