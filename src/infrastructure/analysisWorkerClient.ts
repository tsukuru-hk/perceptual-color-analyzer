import type { AnalysisRequest, AnalysisResponse, AnalysisParams } from './analysisWorkerProtocol'
import type { AnalysisKey } from '@/types/analysis'
import type { ColorAwareImageData } from '@/domain/colorSpace'

let worker: Worker | null = null

interface PendingEntry {
  imageId: string
  analysisKey: AnalysisKey
  resolve: (response: AnalysisResponse) => void
}

const pending = new Map<string, PendingEntry>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./analysisWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<AnalysisResponse>) => {
      const entry = pending.get(e.data.requestId)
      if (entry) {
        pending.delete(e.data.requestId)
        entry.resolve(e.data)
      }
    }
    worker.onerror = (e) => {
      console.error('[AnalysisWorker] Worker error:', e.message)
      // 全 pending を error として解決し、無限待ちを防止
      for (const [requestId, entry] of pending) {
        entry.resolve({
          requestId,
          imageId: entry.imageId,
          analysisKey: entry.analysisKey,
          status: 'error',
          errorMessage: 'Worker がクラッシュしました。再試行してください。',
        })
      }
      pending.clear()
      worker = null // 次回呼び出しで再生成
    }
  }
  return worker
}

/**
 * Worker に分析処理を依頼する。
 * ImageData はクローンしてから transfer するため、元データは安全に保持される。
 */
export function requestAnalysis(
  imageId: string,
  analysisKey: AnalysisKey,
  source: ColorAwareImageData,
  params?: AnalysisParams,
): { requestId: string; promise: Promise<AnalysisResponse> } {
  const requestId = crypto.randomUUID()

  const clonedData = new ImageData(
    new Uint8ClampedArray(source.imageData.data),
    source.imageData.width,
    source.imageData.height,
  )

  const promise = new Promise<AnalysisResponse>((resolve) => {
    pending.set(requestId, { imageId, analysisKey, resolve })
  })

  const msg: AnalysisRequest = {
    requestId,
    imageId,
    analysisKey,
    imageData: clonedData,
    colorSpace: source.colorSpace,
    params,
  }

  getWorker().postMessage(msg, [clonedData.data.buffer])

  return { requestId, promise }
}

/** 指定画像の pending コールバックを全て破棄する（Worker は処理を続けるが結果は無視される） */
export function cancelByImageId(imageId: string): void {
  for (const [requestId, entry] of pending) {
    if (entry.imageId === imageId) {
      pending.delete(requestId)
    }
  }
}
