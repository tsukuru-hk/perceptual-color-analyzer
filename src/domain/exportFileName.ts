/**
 * 分析結果 PNG ダウンロード用のファイル名を生成する。
 * Domain: 純粋な文字列処理のみ（外部依存なし）。
 */

/** 各分析結果に対応するファイル名の接尾辞 */
export const EXPORT_SUFFIX = {
  /** 明度グレースケール */
  lightnessGrayscale: '_lightness_grayscale',
  /** 彩度グレースケール */
  chromaGrayscale: '_chroma_grayscale',
  /** 色相 3D */
  hue3d: '_hue_3d',
  /** ガマット 3D */
  gamut3d: '_gamut_3d',
  /** カラーバブル */
  colorBubble: '_color_bubble',
} as const

/**
 * 元画像のファイル名から拡張子を取り除き、分析種別の接尾辞と `.png` を付与する。
 * @param originalFileName 元画像のファイル名（例: `"photo.jpg"`）
 * @param suffix 分析種別の接尾辞（例: `"_lightness_grayscale"`）
 * @returns ダウンロード用ファイル名（例: `"photo_lightness_grayscale.png"`）
 */
export function buildExportFileName(originalFileName: string, suffix: string): string {
  const base = stripExtension(originalFileName)
  return `${base}${suffix}.png`
}

/** AI 分析用データに対応するファイル名の接尾辞 */
export const DATA_EXPORT_SUFFIX = {
  /** ガマット 3D 生ポイントクラウド */
  gamut3d: '_gamut_3d_points',
  /** 色分布（カラーパレット） */
  colorDistribution: '_color_distribution',
} as const

/**
 * 元画像のファイル名から拡張子を取り除き、分析種別の接尾辞と拡張子を付与する。
 * AI 分析用データのダウンロードに使う（PNG 版と対を成す）。
 * @param originalFileName 元画像のファイル名（例: `"photo.jpg"`）
 * @param suffix 分析種別の接尾辞（例: `"_gamut_3d_points"`）
 * @param ext 拡張子（`.` なし。例: `"csv"`, `"json"`）
 * @returns ダウンロード用ファイル名（例: `"photo_gamut_3d_points.csv"`）
 */
export function buildDataExportFileName(originalFileName: string, suffix: string, ext: string): string {
  const base = stripExtension(originalFileName)
  return `${base}${suffix}.${ext}`
}

/** 拡張子を除いたベース名を返す（空なら `"image"`） */
function stripExtension(originalFileName: string): string {
  return originalFileName.replace(/\.[^/.]+$/, '').trim() || 'image'
}
