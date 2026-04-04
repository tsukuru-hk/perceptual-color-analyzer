/**
 * 画像ファイルの読み込みと Canvas への描画。
 * Infrastructure: ブラウザ API（File, Canvas）に依存。
 */

import type { Result } from '@/core/result';
import { success, failure } from '@/core/result';
import { BaseError } from '@/core/result';
import type { ColorSpace, ColorAwareImageData } from '@/domain/colorSpace';

export type ImageLoadError = 'FileReadError' | 'CanvasError' | 'InvalidImage';

/**
 * File を読み込み、Canvas に描画して ColorAwareImageData を返す。
 * Canvas の colorSpace オプションを使い、P3 画像を正しく読み取る。
 * リサイズせず原寸で読み込むことで、補間による色のブレを防ぐ。
 * @param file 画像ファイル
 * @param colorSpace 使用する作業色空間
 */
export async function loadImageToColorAwareImageData(
  file: File,
  colorSpace: ColorSpace,
): Promise<Result<ColorAwareImageData, ImageLoadError>> {
  const img = await loadFileAsImage(file);
  if (img.isFailure()) return img;
  return drawToCanvasAndGetImageData(img.value, colorSpace);
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
 * @param colorSpace Canvas に適用する色空間
 */
function drawToCanvasAndGetImageData(
  img: HTMLImageElement,
  colorSpace: ColorSpace,
): Result<ColorAwareImageData, ImageLoadError> {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const canvasColorSpace = colorSpace === 'display-p3' ? 'display-p3' : 'srgb';
  const ctx = canvas.getContext('2d', { colorSpace: canvasColorSpace });
  if (!ctx) {
    return failure(
      new BaseError<ImageLoadError>({
        name: 'CanvasError',
        message: 'Could not get 2d context',
      })
    );
  }
  ctx.drawImage(img, 0, 0);
  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return success({ imageData, colorSpace });
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
