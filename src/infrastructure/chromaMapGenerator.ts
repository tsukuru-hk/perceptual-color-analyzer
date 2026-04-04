/**
 * 彩度チャンネルをグレースケール画像へ変換（Culori OKLCH）。
 * Infrastructure: ピクセルループと Canvas 非依存の純粋な ImageData 生成。
 */
import { type Result, success } from '@/core/result'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import { createPixelConverter } from '@/infrastructure/colorSpaceConverter'

export type ChromaMapError = 'ConversionError'

/**
 * 8ビット RGB の量子化ノイズを無彩色と見なす閾値。
 * RGB 各チャンネルの最大差がこの値以下のピクセルは chroma = 0 として扱う。
 * 暗部では ±1 の差で OKLCH chroma が 0.02 程度発生するため、これを除去する。
 */
const RGB_ACHROMATIC_THRESHOLD = 2

/**
 * 画像の各ピクセルの OKLCH chroma 値をグレースケールに変換した ImageData を生成する。
 * 最大 chroma で正規化し、彩度が高い部分ほど明るく表示される。
 * @param source 色空間情報付き入力画像
 */
export function generateChromaMap(
  source: ColorAwareImageData,
): Result<ImageData, ChromaMapError> {
  const { data, width, height } = source.imageData
  const pixelCount = width * height
  const chromaValues = new Float32Array(pixelCount)
  let maxChroma = 0
  const toOklch = createPixelConverter(source.colorSpace)

  const opaqueFlags = new Uint8Array(pixelCount)
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    if (data[offset + 3]! < 128) continue
    opaqueFlags[i] = 1
    const r = data[offset]!, g = data[offset + 1]!, b = data[offset + 2]!
    if (Math.max(r, g, b) - Math.min(r, g, b) <= RGB_ACHROMATIC_THRESHOLD) continue
    const result = toOklch(r, g, b)
    const c = result?.c ?? 0
    chromaValues[i] = c
    if (c > maxChroma) maxChroma = c
  }

  const output = new ImageData(width, height)
  const outData = output.data

  if (maxChroma === 0) {
    for (let i = 0; i < pixelCount; i++) {
      const offset = i * 4
      outData[offset] = 0
      outData[offset + 1] = 0
      outData[offset + 2] = 0
      outData[offset + 3] = opaqueFlags[i] ? 255 : 0
    }
    return success(output)
  }

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    if (!opaqueFlags[i]) {
      outData[offset] = 0
      outData[offset + 1] = 0
      outData[offset + 2] = 0
      outData[offset + 3] = 0
      continue
    }
    const gray = Math.round((chromaValues[i]! / maxChroma) * 255)
    outData[offset] = gray
    outData[offset + 1] = gray
    outData[offset + 2] = gray
    outData[offset + 3] = 255
  }

  return success(output)
}
