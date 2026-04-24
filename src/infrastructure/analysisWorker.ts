/// <reference lib="webworker" />

import { generateChromaMap } from './chromaMapGenerator'
import { generateChromaHistogram } from './chromaHistogramGenerator'
import { generateLightnessMap } from './lightnessMapGenerator'
import { generateLightnessHistogram } from './lightnessHistogramGenerator'
import { generateGamutPointCloud } from './gamutPointCloudGenerator'
import { generateColorClusters } from './colorClusterGenerator'
import { generateHueAnalysis } from './hueAnalysisGenerator'
import type { AnalysisRequest, AnalysisResponse } from './analysisWorkerProtocol'
import type { ColorAwareImageData } from '../domain/colorSpace'

declare const self: DedicatedWorkerGlobalScope

self.onmessage = (e: MessageEvent<AnalysisRequest>) => {
  const { requestId, imageId, analysisKey, imageData, colorSpace } = e.data
  const source: ColorAwareImageData = { imageData, colorSpace }

  let response: AnalysisResponse
  const transferList: Transferable[] = []

  switch (analysisKey) {
    case 'chromaMap': {
      const r = generateChromaMap(source)
      if (r.isSuccess()) {
        response = { requestId, imageId, analysisKey, status: 'success', imageData: r.value }
        transferList.push(r.value.data.buffer)
      } else {
        response = { requestId, imageId, analysisKey, status: 'error', errorMessage: r.error.message }
      }
      break
    }
    case 'chromaHistogram': {
      const r = generateChromaHistogram(source)
      if (r.isSuccess()) {
        response = { requestId, imageId, analysisKey, status: 'success', histogramData: r.value }
      } else {
        response = { requestId, imageId, analysisKey, status: 'error', errorMessage: r.error.message }
      }
      break
    }
    case 'lightnessMap': {
      const r = generateLightnessMap(source)
      if (r.isSuccess()) {
        response = { requestId, imageId, analysisKey, status: 'success', imageData: r.value }
        transferList.push(r.value.data.buffer)
      } else {
        response = { requestId, imageId, analysisKey, status: 'error', errorMessage: r.error.message }
      }
      break
    }
    case 'lightnessHistogram': {
      const r = generateLightnessHistogram(source)
      if (r.isSuccess()) {
        response = { requestId, imageId, analysisKey, status: 'success', histogramData: r.value }
      } else {
        response = { requestId, imageId, analysisKey, status: 'error', errorMessage: r.error.message }
      }
      break
    }
    case 'gamutPointCloud': {
      const r = generateGamutPointCloud(source)
      if (r.isSuccess()) {
        response = { requestId, imageId, analysisKey, status: 'success', gamutPointCloudData: r.value }
        transferList.push(r.value.positions.buffer, r.value.colors.buffer)
      } else {
        response = { requestId, imageId, analysisKey, status: 'error', errorMessage: r.error.message }
      }
      break
    }
    case 'colorClustering': {
      try {
        const paletteSize = e.data.params?.paletteSize
        const r = generateColorClusters(source, paletteSize)
        if (r.isSuccess()) {
          response = { requestId, imageId, analysisKey, status: 'success', colorClusterData: r.value }
        } else {
          response = { requestId, imageId, analysisKey, status: 'error', errorMessage: r.error.message }
        }
      } catch (err) {
        response = { requestId, imageId, analysisKey, status: 'error', errorMessage: String(err) }
      }
      break
    }
    case 'hueAnalysis': {
      const r = generateHueAnalysis(source)
      if (r.isSuccess()) {
        response = { requestId, imageId, analysisKey, status: 'success', hueAnalysisData: r.value }
        if (r.value.bandMask) transferList.push(r.value.bandMask.buffer)
      } else {
        response = { requestId, imageId, analysisKey, status: 'error', errorMessage: r.error.message }
      }
      break
    }
  }

  self.postMessage(response!, transferList)
}
