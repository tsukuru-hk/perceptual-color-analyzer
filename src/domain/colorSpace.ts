/**
 * 色空間に関するドメイン型定義。
 * Domain: 純粋な型のみ。ブラウザ API に依存しない。
 */

/** アプリがサポートする作業色空間 */
export type ColorSpace = 'srgb' | 'display-p3'

/** ディスプレイの色域能力（将来の Rec.2020 対応を含む） */
export type DisplayGamut = 'srgb' | 'p3' | 'rec2020'

/**
 * 3D ガマットのワイヤーフレーム表示に使うガマット種別。
 *
 * `lch-rec601` は実験用の一時モード。ガマット境界（最大 Chroma）は sRGB で
 * 求めつつ、縦軸の明度を OKLCH の L ではなく Rec.601 luma
 * (0.299R' + 0.587G' + 0.114B') で取り直した LCH 風の色立体を表示する。
 */
export type WireframeGamut = 'srgb' | 'display-p3' | 'rec2020' | 'lch-rec601'

/**
 * 色空間情報を持つ画像データ。
 * ImageData 単体では「このピクセル値はどの色空間か」が不明なため、
 * 色空間を明示的に紐付ける。
 */
export interface ColorAwareImageData {
  readonly imageData: ImageData
  readonly colorSpace: ColorSpace
}
