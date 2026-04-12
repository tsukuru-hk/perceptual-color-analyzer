/**
 * 画像ピクセルから OKLCH 3D ポイントクラウドを生成する。
 * Infrastructure: Culori 経由の色変換 + ドメイン層の座標変換に依存。
 */
import { type Result, success } from '@/core/result'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import { oklchToPosition, DEFAULT_GAMUT_SCALE } from '@/domain/oklchTo3d'
import { createPixelConverter } from '@/infrastructure/colorSpaceConverter'
import type { GamutPointCloudData } from '@/types/analysis'

export type GamutPointCloudError = 'ConversionError'

/** 生成する最大点数 */
const MAX_POINTS = 20_000

/**
 * 画像から OKLCH 3D ポイントクラウドを生成する。
 * stride ベースでサンプリングし、Float32Array で座標と色を返す。
 *
 * @param source 色空間情報付き入力画像
 * @param stride サンプリング間隔（デフォルト: 4）
 */
export function generateGamutPointCloud(
  source: ColorAwareImageData,
  maxPoints: number = MAX_POINTS,
): Result<GamutPointCloudData, GamutPointCloudError> {
  const { data, width, height } = source.imageData
  const totalPixels = width * height
  const toOklch = createPixelConverter(source.colorSpace)

  // 画像サイズから stride を自動計算して maxPoints 以内に収める
  const stride = Math.max(1, Math.floor(totalPixels / maxPoints))
  const sampledMax = Math.min(Math.ceil(totalPixels / stride), maxPoints)

  // 事前確保
  const positions = new Float32Array(sampledMax * 3)
  const colors = new Float32Array(sampledMax * 3)
  let count = 0

  for (let i = 0; i < totalPixels && count < sampledMax; i += stride) {
    const offset = i * 4
    // 透明ピクセルをスキップ
    if (data[offset + 3]! < 128) continue

    const r = data[offset]!
    const g = data[offset + 1]!
    const b = data[offset + 2]!

    const oklch = toOklch(r, g, b)
    if (!oklch) continue

    const pos = oklchToPosition(oklch.l, oklch.c, oklch.h, DEFAULT_GAMUT_SCALE)

    const idx3 = count * 3
    positions[idx3] = pos.x
    positions[idx3 + 1] = pos.y
    positions[idx3 + 2] = pos.z

    colors[idx3] = r / 255
    colors[idx3 + 1] = g / 255
    colors[idx3 + 2] = b / 255

    count++
  }

  return success({
    positions: positions.subarray(0, count * 3),
    colors: colors.subarray(0, count * 3),
    count,
    totalPixels,
  })
}
