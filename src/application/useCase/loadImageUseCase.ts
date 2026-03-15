/**
 * 画像ファイルを読み込み、Canvas に描画した ImageData を返すユースケース。
 * Application層: インフラを組み合わせてシナリオを実行。
 */

import type { Result } from '@/core/result';
import { loadImageToImageData } from '@/infrastructure/imageLoader';
import type { ImageLoadError } from '@/infrastructure/imageLoader';

const DEFAULT_MAX_WIDTH = 800;
const DEFAULT_MAX_HEIGHT = 600;

/**
 * @param file 画像ファイル
 * @param options maxWidth / maxHeight で描画サイズを指定（省略時 800×600）
 */
export async function loadImageUseCase(
  file: File,
  options?: { maxWidth?: number; maxHeight?: number }
): Promise<Result<ImageData, ImageLoadError>> {
  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxHeight = options?.maxHeight ?? DEFAULT_MAX_HEIGHT;
  return loadImageToImageData(file, maxWidth, maxHeight);
}
