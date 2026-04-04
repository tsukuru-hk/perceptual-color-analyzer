import type { AnalysisKey, GamutPointCloudData } from '@/types/analysis'
import type { ColorSpace } from '@/domain/colorSpace'
import type { HistogramData } from '@/infrastructure/histogramTypes'

/** メインスレッド → Worker */
export interface AnalysisRequest {
  requestId: string
  imageId: string
  analysisKey: AnalysisKey
  imageData: ImageData
  colorSpace: ColorSpace
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
  errorMessage?: string
}
