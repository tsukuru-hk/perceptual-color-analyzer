/**
 * 知覚的色空間 OKLCH の値オブジェクト。
 * L: Lightness（明度）, C: Chroma（彩度）, h: Hue（色相）
 */

export interface OklchValue {
  readonly L: number;
  readonly C: number;
  readonly h: number;
}

export function createOklch(L: number, C: number, h: number): OklchValue {
  return { L, C, h };
}
