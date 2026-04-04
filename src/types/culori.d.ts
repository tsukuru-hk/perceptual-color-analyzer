declare module 'culori' {
  /** RGB 系の色オブジェクト（sRGB / Display P3） */
  type RgbColor =
    | { mode: 'rgb'; r: number; g: number; b: number }
    | { mode: 'p3'; r: number; g: number; b: number }

  /** sRGB / Display P3 / CSS 文字列 → OKLCH 変換。無彩色では h が undefined（powerless hue）になる */
  export function oklch(
    color: string | RgbColor
  ): { mode: 'oklch'; l: number; c: number; h: number | undefined } | undefined

  export function converter(
    mode: string
  ): (color: { mode: string; l?: number; c?: number; h?: number; r?: number; g?: number; b?: number }) =>
    { mode: string; r: number; g: number; b: number } | undefined

  export function formatHex(color: { mode: string; [key: string]: unknown }): string

  /** OKLCH chroma を sRGB ガマット内に収まるよう縮小する */
  export function clampChroma(
    color: { mode: string; [key: string]: unknown },
    mode?: string
  ): { mode: string; [key: string]: unknown }
}
