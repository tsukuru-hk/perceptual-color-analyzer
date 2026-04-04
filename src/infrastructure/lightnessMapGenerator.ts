/**
 * 明度チャンネルをグレースケール画像へ変換（Culori OKLCH）。
 * Infrastructure: ピクセルループと Canvas 非依存の純粋な ImageData 生成。
 */
import { oklch } from 'culori'
import { type Result, success } from '@/core/result'

export type LightnessMapError = 'ConversionError'

/**
 * 画像の各ピクセルの OKLCH lightness 値をグレースケールに変換した ImageData を生成する。
 * L は 0〜1 の範囲なので、そのまま 0〜255 にマッピングする。
 * @param imageData 入力のラスタ画像
 */
export function generateLightnessMap(
  imageData: ImageData,
): Result<ImageData, LightnessMapError> {
  const { data, width, height } = imageData
  const pixelCount = width * height

  const output = new ImageData(width, height)
  const outData = output.data

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    const r = data[offset]! / 255
    const g = data[offset + 1]! / 255
    const b = data[offset + 2]! / 255

    const result = oklch({ mode: 'rgb', r, g, b })
    const l = result?.l ?? 0
    const gray = Math.round(l * 255)

    outData[offset] = gray
    outData[offset + 1] = gray
    outData[offset + 2] = gray
    outData[offset + 3] = 255
  }

  return success(output)
}
