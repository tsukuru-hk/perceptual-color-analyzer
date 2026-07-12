/**
 * 分析結果を「AI が一次データに直接触れられる」エクスポート形式へ変換するビルダー群。
 * Domain: 純粋関数のみ（ブラウザ API 非依存）。
 *
 * 方針:
 * - 要約はしない。生データ（点群・パレット）をそのまま渡し、要約は読ませた後に
 *   AI 自身にやらせる。
 * - 大量点は JSON 配列よりトークン効率の良い CSV で出す（AI がコードでも解析しやすい）。
 * - 先頭に自己記述用のメタ情報（画像素性・列定義）を付け、単体で解釈できるようにする。
 * - OKLCH: l=明度(0–1), c=彩度(0≈無彩色), h=色相(度 0–360)。
 */

import type { ColorSpace } from './colorSpace'
import type { ColorClusterResult } from './colorCluster'
import type { GamutPointCloudData } from '@/types/analysis'
import { DEFAULT_GAMUT_SCALE, type GamutScaleConfig } from './oklchTo3d'

/** エクスポートの共通メタ情報（元画像の素性） */
export interface ExportImageMeta {
  readonly fileName: string
  readonly colorSpace: ColorSpace
  readonly width: number
  readonly height: number
}

/** 色分布 JSON が共有するスキーマバージョン */
const SCHEMA_VERSION = 1

// ─── 数値ユーティリティ ───

/** 小数 n 桁に丸める（冗長な桁を抑える） */
function round(value: number, digits = 4): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

/** 0–255 の RGB を #rrggbb 形式に変換する */
function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

// ─── 3D ガマット（生ポイントクラウド → CSV）──────────

/**
 * 3D ガマットのポイントクラウドを「生の点」CSV に変換する。
 * 可視化が描いているサンプル点（最大 20,000）を 1 行 1 点でそのまま出力し、
 * AI が自分で分布を集計・クラスタリングできるようにする。要約はしない。
 *
 * OKLCH は 3D 座標（positions）を逆変換して復元（可視化と厳密に一致）、
 * hex は点の色（colors）から生成する。
 *
 * 列: l, c, h, hex
 */
export function buildGamutPointsCsv(
  data: GamutPointCloudData,
  meta: ExportImageMeta,
  generatedAt: string,
  scale: GamutScaleConfig = DEFAULT_GAMUT_SCALE,
): string {
  const rad2deg = 180 / Math.PI
  const lines: string[] = [
    '# Coloralyzer — 3D ガマットの生ポイントクラウド（要約なし / raw points）',
    '# 目的: この点群を 3D として再構成し、任意の角度から色の分布・広がり・偏りを解析するためのデータ。',
    `# generatedAt: ${generatedAt}`,
    `# image: ${meta.fileName} | colorSpace: ${meta.colorSpace} | ${meta.width}x${meta.height} | totalPixels: ${data.totalPixels}`,
    `# sampledPoints: ${data.count}（画像ピクセルの一様サンプル。1 行 = 3D 空間の 1 点）`,
    '# columns: l=明度(0-1), c=彩度(0=無彩色/大きいほど鮮やか), h=色相(度 0-360), hex=点の色(image colorSpace の sRGB 近似)',
    '# 3D 再構成: OKLCH は円柱座標。直交座標(OKLab)へは  L=l,  a=c*cos(h*pi/180),  b=c*sin(h*pi/180)。',
    '#   → 点を (a, b, L) に配置すると知覚均一な 3D 空間になり、ユークリッド距離 ≈ 知覚的な色差。',
    '#   → この (a,b,L) で散布・PCA・凸包・任意方向への投影を行えば、スクショ 1 枚では見えない立体構造を把握できる。',
    '#   軸の意味: L=上下(明度), 中心からの距離=彩度, 中心まわりの角度=色相。',
    'l,c,h,hex',
  ]

  for (let i = 0; i < data.count; i++) {
    const x = data.positions[i * 3]!
    const y = data.positions[i * 3 + 1]!
    const z = data.positions[i * 3 + 2]!
    // oklchToPosition の逆変換
    const l = y / scale.lightnessScale + 0.5
    const c = Math.hypot(x, z) / scale.chromaScale
    let h = Math.atan2(z, x) * rad2deg
    if (h < 0) h += 360

    const hex = rgbToHex(
      data.colors[i * 3]! * 255,
      data.colors[i * 3 + 1]! * 255,
      data.colors[i * 3 + 2]! * 255,
    )

    lines.push(`${round(l, 3)},${round(c, 4)},${round(h, 1)},${hex}`)
  }

  return lines.join('\n') + '\n'
}

// ─── 色分布（クラスタリング → JSON）─────────────────────

/**
 * 色分布（カラーパレット抽出）結果を JSON 化する。
 * パレットはこのページの一次成果物そのものなので、そのまま渡す。
 * 各色は面積比 `ratio` 降順。sRGB 表現の hex / rgb と OKLCH を併記する。
 */
export function buildDistributionExport(
  result: ColorClusterResult,
  meta: ExportImageMeta,
  generatedAt: string,
) {
  const colors = result.clusters.map((c, i) => ({
    rank: i + 1,
    hex: rgbToHex(c.centroidRgb.r, c.centroidRgb.g, c.centroidRgb.b),
    ratio: round(c.ratio, 5),
    percentage: round(c.ratio * 100, 2),
    pixelCount: c.pixelCount,
    rgb: { r: Math.round(c.centroidRgb.r), g: Math.round(c.centroidRgb.g), b: Math.round(c.centroidRgb.b) },
    oklch: { l: round(c.centroid.lightness), c: round(c.centroid.chroma), h: round(c.centroid.hue, 2) },
  }))

  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'color-distribution' as const,
    app: 'Coloralyzer',
    generatedAt,
    description:
      '画像から抽出した代表色（カラーパレット）。OKLCH 知覚色空間での k-means クラスタリング結果。' +
      'colors は面積比 ratio の降順。ratio は画像全体に占める面積割合(0–1)、hex/rgb は sRGB 表現、' +
      'oklch は l=明度(0–1) c=彩度(0≈無彩色) h=色相(度 0–360)。',
    image: {
      fileName: meta.fileName,
      colorSpace: meta.colorSpace,
      width: meta.width,
      height: meta.height,
      totalPixels: result.totalPixels,
    },
    palette: {
      count: result.clusters.length,
      colors,
    },
  }
}
