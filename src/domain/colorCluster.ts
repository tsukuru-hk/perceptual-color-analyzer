/**
 * カラークラスタリング結果の型定義。
 * 各サンプル色に安定 ID を持たせ、k 変更時のアニメーション追跡を可能にする。
 */

import type { OklchValue } from './oklch'

/** サンプリングされた1色（安定IDで追跡可能） */
export interface ColorSample {
  /** 安定 ID（同一画像なら k 変更後も同じ ID を保持） */
  readonly id: number
  /** OKLCH 値 */
  readonly oklch: OklchValue
  /** sRGB 値 (0-255) */
  readonly rgb: { readonly r: number; readonly g: number; readonly b: number }
  /** このサンプルが代表するピクセル数 */
  readonly pixelCount: number
  /** 所属クラスタ ID */
  readonly clusterId: number
}

/** 1つのクラスタ（色グループ） */
export interface ColorCluster {
  /** クラスタ ID (0-indexed) */
  readonly id: number
  /** 重心の OKLCH */
  readonly centroid: OklchValue
  /** 重心の sRGB (0-255) */
  readonly centroidRgb: { readonly r: number; readonly g: number; readonly b: number }
  /** このクラスタに属するピクセル数 */
  readonly pixelCount: number
  /** 全体に対する割合 (0-1) */
  readonly ratio: number
}

/** クラスタリング結果全体 */
export interface ColorClusterResult {
  /** クラスタ一覧（ratio 降順ソート済み） */
  readonly clusters: ReadonlyArray<ColorCluster>
  /** 全サンプル色（安定 ID 付き） */
  readonly samples: ReadonlyArray<ColorSample>
  /** 元画像の全ピクセル数 */
  readonly totalPixels: number
  /** 使用したクラスタ数 */
  readonly k: number
}
