/**
 * 明度チャンネルをグレースケール画像へ変換（Culori OKLCH）。
 * Infrastructure: ピクセルループと Canvas 非依存の純粋な ImageData 生成。
 */
import { converter } from 'culori'
import { type Result, success } from '@/core/result'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import { createPixelConverter } from '@/infrastructure/colorSpaceConverter'

export type LightnessMapError = 'ConversionError'

const toRgb = converter('rgb')

/**
 * OKLCH L → sRGB グレー値の LUT（256 段階）。
 * L をそのまま sRGB ピクセル値にすると知覚明度とガンマが二重適用されるため、
 * OKLCH(L, 0, 0) → sRGB の逆変換で正しいグレー値を得る。
 */
const lightnessToSrgbLut = (() => {
  const lut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    const l = i / 255
    const srgb = toRgb({ mode: 'oklch', l, c: 0, h: 0 })
    lut[i] = Math.round(Math.max(0, Math.min(1, srgb?.r ?? 0)) * 255)
  }
  return lut
})()

/**
 * 画像の各ピクセルの OKLCH lightness 値をグレースケールに変換した ImageData を生成する。
 * L を sRGB エンコードに逆変換し、ディスプレイ上で正しい明度が再現されるようにする。
 * @param source 色空間情報付き入力画像
 */
export function generateLightnessMap(
  source: ColorAwareImageData,
): Result<ImageData, LightnessMapError> {
  const { data, width, height } = source.imageData
  const pixelCount = width * height
  const toOklch = createPixelConverter(source.colorSpace)

  const output = new ImageData(width, height)
  const outData = output.data

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    const alpha = data[offset + 3]!
    if (alpha < 128) {
      outData[offset] = 0
      outData[offset + 1] = 0
      outData[offset + 2] = 0
      outData[offset + 3] = 0
      continue
    }
    const result = toOklch(data[offset]!, data[offset + 1]!, data[offset + 2]!)
    const l = result?.l ?? 0
    const gray = lightnessToSrgbLut[Math.min(Math.round(l * 255), 255)]!

    outData[offset] = gray
    outData[offset + 1] = gray
    outData[offset + 2] = gray
    outData[offset + 3] = 255
  }

  return success(output)
}
