/**
 * 知覚的色空間 OKLCH の値オブジェクト。
 * lightness: Lightness（明度）, chroma: Chroma（彩度）, hue: Hue（色相）
 */

export interface OklchValue {
  readonly lightness: number;
  readonly chroma: number;
  readonly hue: number;
}

/**
 * @param lightness 明度 (Lightness, 0–1)
 * @param chroma 彩度 (Chroma, 0–0.4+)
 * @param hue 色相 (Hue, 0–360)
 */
export function createOklch(lightness: number, chroma: number, hue: number): OklchValue {
  return { lightness, chroma, hue };
}
