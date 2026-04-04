/**
 * ヒストグラム共通型定義。
 * 彩度・明度・色相など、任意の OKLCH チャンネルの分布表現に使用する。
 */

export interface HistogramBin {
  rangeStart: number
  rangeEnd: number
  count: number
}

export interface HistogramData {
  bins: HistogramBin[]
  totalPixels: number
  /** x 軸の範囲 (例: lightness [0, 1], chroma [0, maxChroma]) */
  domain: [number, number]
}

export type HistogramError = 'ConversionError'
