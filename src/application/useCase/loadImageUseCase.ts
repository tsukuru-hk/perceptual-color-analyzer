/**
 * 画像ファイルを読み込み、Canvas に描画した ColorAwareImageData を返すユースケース。
 * Application層: インフラを組み合わせてシナリオを実行。
 *
 * 色分析の精度を保つため、リサイズせず原寸で読み込む。
 * 補間によるピクセル混合を避けることで、元画像に忠実な色情報を保持する。
 */

import type { Result } from '@/core/result';
import type { ColorSpace, ColorAwareImageData } from '@/domain/colorSpace';
import { loadImageToColorAwareImageData } from '@/infrastructure/imageLoader';
import type { ImageLoadError } from '@/infrastructure/imageLoader';

/**
 * @param file 画像ファイル
 * @param colorSpace 作業色空間
 */
export async function loadImageUseCase(
  file: File,
  colorSpace: ColorSpace,
): Promise<Result<ColorAwareImageData, ImageLoadError>> {
  return loadImageToColorAwareImageData(file, colorSpace);
}
