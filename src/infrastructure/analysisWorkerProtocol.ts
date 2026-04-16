import type { AnalysisKey, GamutPointCloudData } from '@/types/analysis'
import type { ColorSpace } from '@/domain/colorSpace'
import type { HistogramData } from '@/infrastructure/histogramTypes'
import type { ColorClusterResult } from '@/domain/colorCluster'

/** 分析種別ごとのパラメータ */
export interface AnalysisParams {
  /** colorClustering 用: クラスタ数 k */
  clusterK?: number
}

/** メインスレッド → Worker */
export interface AnalysisRequest {
  requestId: string
  imageId: string
  analysisKey: AnalysisKey
  imageData: ImageData
  colorSpace: ColorSpace
  params?: AnalysisParams
}

/** Worker → メインスレッド */
export interface AnalysisResponse {
  requestId: string
  imageId: string
  analysisKey: AnalysisKey
  status: 'success' | 'error'
  imageData?: ImageData
  histogramData?: HistogramData
  gamutPointCloudData?: GamutPointCloudData
  colorClusterData?: ColorClusterResult
  errorMessage?: string
}
