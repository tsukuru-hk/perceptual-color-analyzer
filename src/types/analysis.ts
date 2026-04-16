import type { HistogramData } from '@/infrastructure/histogramTypes'
import type { ColorClusterResult } from '@/domain/colorCluster'

/** 3D ガマットポイントクラウドデータ */
export interface GamutPointCloudData {
  /** 3D 座標 [x,y,z, x,y,z, ...] */
  readonly positions: Float32Array
  /** RGB 色 [r,g,b, r,g,b, ...] (0–1) */
  readonly colors: Float32Array
  /** 実際の点数 */
  readonly count: number
  /** 元画像の全ピクセル数 */
  readonly totalPixels: number
}

/** 分析種別 */
export type AnalysisKey = 'chromaMap' | 'chromaHistogram' | 'lightnessMap' | 'lightnessHistogram' | 'gamutPointCloud' | 'colorClustering'

/** 分析種別ごとの結果型 */
export type AnalysisResult = {
  chromaMap: ImageData
  chromaHistogram: HistogramData
  lightnessMap: ImageData
  lightnessHistogram: HistogramData
  gamutPointCloud: GamutPointCloudData
  colorClustering: ColorClusterResult
}

/** 分析エラー情報 */
export interface AnalysisError {
  readonly _tag: 'AnalysisError'
  readonly analysisKey: AnalysisKey
  readonly message: string
}

export function isAnalysisError(value: unknown): value is AnalysisError {
  return value != null && typeof value === 'object' && '_tag' in value && (value as AnalysisError)._tag === 'AnalysisError'
}
