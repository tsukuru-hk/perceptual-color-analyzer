/**
 * 色相分析 (Hue Analysis) の型定義。
 * 極座標ベースのローズダイアグラム + 密度ガマットシェイプを構成するデータ。
 */

/** RGB 色値 (0-255) */
export interface Rgb {
  readonly r: number
  readonly g: number
  readonly b: number
}

/** ローズダイアグラムの1セクター */
export interface HueSector {
  /** 色相範囲の開始角度 (度) */
  readonly hueStart: number
  /** 色相範囲の終了角度 (度) */
  readonly hueEnd: number
  /** 全有彩色ピクセルに対する占有率 (0-1) */
  readonly ratio: number
  /** ピクセル数 */
  readonly count: number
  /** セクター中心色の sRGB 表現 */
  readonly fillRgb: Rgb
}

/** 極座標密度グリッドの1セル */
export interface PolarDensityCell {
  /** 色相ビン index (0-based) */
  readonly hueBin: number
  /** 彩度ビン index (0-based) */
  readonly chromaBin: number
  /** セル中心の色相 (度) */
  readonly hueCenter: number
  /** セル中心の彩度 */
  readonly chromaCenter: number
  /** 正規化密度 (0-1, 最も密なセル = 1) */
  readonly density: number
  /**
   * 累積パーセンタイル: このセル以上の密度を持つセル群が
   * 全有彩色ピクセルの何%を占めるか (0-1)。
   * 0.3 なら「上位30%に属する密なセル」。
   */
  readonly cumulativePercentile: number
  /** セル中心色の sRGB 表現 */
  readonly fillRgb: Rgb
}

/** 明度帯ごとの分析データ */
export interface LightnessBandData {
  readonly label: 'dark' | 'mid' | 'light'
  /** 明度範囲 [min, max] */
  readonly range: [number, number]
  /** この帯のローズダイアグラムセクター */
  readonly sectors: ReadonlyArray<HueSector>
  /** この帯の密度セル */
  readonly densityCells: ReadonlyArray<PolarDensityCell>
  /** この帯の有彩色ピクセル数 */
  readonly pixelCount: number
}

/** 色相分析の完全な結果 */
export interface HueAnalysisResult {
  /** 全体のローズダイアグラムセクター */
  readonly sectors: ReadonlyArray<HueSector>
  /** 全体の密度セル (count > 0 のセルのみ) */
  readonly densityCells: ReadonlyArray<PolarDensityCell>
  /** 色相ビン数 */
  readonly hueBinCount: number
  /** 彩度ビン数 */
  readonly chromaBinCount: number
  /** 観測された最大彩度 */
  readonly maxChroma: number
  /**
   * 各色相ビンの sRGB ガマット最大彩度。hueBinCount 個。
   * 地形・グリッド・リングの外縁形状を決める。
   */
  readonly gamutMaxChroma: ReadonlyArray<number>
  /**
   * 色相環リング用の高彩度色。hueBinCount 個。
   * 各色相の最大彩度 (L=0.65, C=0.3) で生成。
   */
  readonly ringColors: ReadonlyArray<Rgb>
  /**
   * カラーホイール全セルの sRGB 色。
   * hueBinCount × chromaBinCount の1次元配列 (row-major: [h0c0, h0c1, ..., h1c0, ...])。
   * ベースホイール描画用。
   */
  readonly wheelColors: ReadonlyArray<Rgb>
  /** 明度帯ごとの分析データ */
  readonly lightnessBands: ReadonlyArray<LightnessBandData>
  /** 有彩色ピクセル数 */
  readonly totalChromaticPixels: number
  /** 不透明ピクセル総数 (無彩色含む) */
  readonly totalOpaquePixels: number
  /**
   * 明度帯バンドマスク。画像全ピクセル分。
   * 0=dark, 1=mid, 2=light, 255=透明/無彩色。
   * LightnessBandPreview で再計算不要にするためのキャッシュ。
   */
  readonly bandMask?: Uint8Array
}
