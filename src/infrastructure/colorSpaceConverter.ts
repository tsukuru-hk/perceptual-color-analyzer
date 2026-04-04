/**
 * 色空間を考慮した RGB↔OKLCH 変換を集約する。
 * Infrastructure: Culori ライブラリに依存。
 *
 * 各 generator が個別に oklch() を呼ぶ代わりに、このモジュールを経由することで
 * 色空間の解釈を一箇所に集約する。
 */
import { oklch } from 'culori'
import type { ColorSpace } from '@/domain/colorSpace'

/** OKLCH 変換結果（h は無彩色でも 0 にフォールバック済み） */
export interface OklchPixel {
  readonly l: number
  readonly c: number
  readonly h: number
}

/** ColorSpace → Culori のモード識別子 */
function toCuloriMode(colorSpace: ColorSpace): 'rgb' | 'p3' {
  return colorSpace === 'display-p3' ? 'p3' : 'rgb'
}

/**
 * 0–255 の RGB ピクセル値を OKLCH に変換する。
 * @param r Red (0–255)
 * @param g Green (0–255)
 * @param b Blue (0–255)
 * @param colorSpace ピクセル値の色空間
 * @returns OKLCH 値。変換失敗時は null
 */
export function pixelToOklch(
  r: number,
  g: number,
  b: number,
  colorSpace: ColorSpace,
): OklchPixel | null {
  const mode = toCuloriMode(colorSpace)
  const result = oklch({ mode, r: r / 255, g: g / 255, b: b / 255 })
  if (!result) return null
  return { l: result.l, c: result.c, h: result.h ?? 0 }
}

/**
 * 特定の色空間に束縛されたピクセル変換関数を生成する。
 * タイトなピクセルループで毎回色空間を渡すオーバーヘッドを避けるために使う。
 * @param colorSpace 変換元の色空間
 */
export function createPixelConverter(
  colorSpace: ColorSpace,
): (r: number, g: number, b: number) => OklchPixel | null {
  const mode = toCuloriMode(colorSpace)
  return (r: number, g: number, b: number): OklchPixel | null => {
    const result = oklch({ mode, r: r / 255, g: g / 255, b: b / 255 })
    if (!result) return null
    return { l: result.l, c: result.c, h: result.h ?? 0 }
  }
}
