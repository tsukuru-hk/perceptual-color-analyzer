/**
 * OKLCH 円柱座標 → 3D デカルト座標への変換。
 * Domain: 純粋な数学関数。外部依存なし。
 *
 * OKLCH は円柱座標系:
 *   L (0–1)    → Y 軸（明度）
 *   C (0–0.4+) → 半径（彩度）
 *   H (0–360)  → 角度（色相）
 */

export interface Point3D {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** 3D 空間のスケール設定 */
export interface GamutScaleConfig {
  /** Chroma → 半径のスケール係数 (デフォルト: 5.0) */
  readonly chromaScale: number
  /** Lightness → Y 軸のスケール係数 (デフォルト: 3.2) */
  readonly lightnessScale: number
}

export const DEFAULT_GAMUT_SCALE: GamutScaleConfig = {
  chromaScale: 6.5,
  lightnessScale: 3.2,
}

const DEG_TO_RAD = Math.PI / 180

/**
 * OKLCH 値を 3D デカルト座標に変換する。
 * Y 軸中心を 0 にシフト（L=0.5 が原点）。
 *
 * @param l Lightness (0–1)
 * @param c Chroma (0–0.4+)
 * @param h Hue (0–360)
 * @param scale スケール設定
 */
export function oklchToPosition(
  l: number,
  c: number,
  h: number,
  scale: GamutScaleConfig = DEFAULT_GAMUT_SCALE,
): Point3D {
  const radius = c * scale.chromaScale
  const theta = h * DEG_TO_RAD
  return {
    x: radius * Math.cos(theta),
    y: (l - 0.5) * scale.lightnessScale,
    z: radius * Math.sin(theta),
  }
}
