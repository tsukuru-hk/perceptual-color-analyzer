import { oklch } from 'culori'
import { type Result, success } from '@/core/result'

export type ChromaMapError = 'ConversionError'

/**
 * 画像の各ピクセルの OKLCH chroma 値をグレースケールに変換した ImageData を生成する。
 * 最大 chroma で正規化し、彩度が高い部分ほど明るく表示される。
 */
export function generateChromaMap(
  imageData: ImageData,
): Result<ImageData, ChromaMapError> {
  const { data, width, height } = imageData
  const pixelCount = width * height
  const chromaValues = new Float32Array(pixelCount)
  let maxChroma = 0

  // 1st pass: 各ピクセルの chroma を取得し、最大値を追跡
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    const r = data[offset] / 255
    const g = data[offset + 1] / 255
    const b = data[offset + 2] / 255

    const result = oklch({ mode: 'rgb', r, g, b })
    const c = result?.c ?? 0
    chromaValues[i] = c
    if (c > maxChroma) maxChroma = c
  }

  // 出力 ImageData を生成
  const output = new ImageData(width, height)
  const outData = output.data

  if (maxChroma === 0) {
    // 完全に無彩色の画像 → 全黒
    for (let i = 0; i < pixelCount; i++) {
      const offset = i * 4
      outData[offset] = 0
      outData[offset + 1] = 0
      outData[offset + 2] = 0
      outData[offset + 3] = 255
    }
    return success(output)
  }

  // 2nd pass: 正規化してグレースケールに変換
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    const gray = Math.round((chromaValues[i] / maxChroma) * 255)
    outData[offset] = gray
    outData[offset + 1] = gray
    outData[offset + 2] = gray
    outData[offset + 3] = 255
  }

  return success(output)
}
