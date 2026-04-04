/**
 * 色空間に関するドメイン型定義。
 * Domain: 純粋な型のみ。ブラウザ API に依存しない。
 */

/** アプリがサポートする作業色空間 */
export type ColorSpace = 'srgb' | 'display-p3'

/** ディスプレイの色域能力（将来の Rec.2020 対応を含む） */
export type DisplayGamut = 'srgb' | 'p3' | 'rec2020'

/**
 * 色空間情報を持つ画像データ。
 * ImageData 単体では「このピクセル値はどの色空間か」が不明なため、
 * 色空間を明示的に紐付ける。
 */
export interface ColorAwareImageData {
  readonly imageData: ImageData
  readonly colorSpace: ColorSpace
}
