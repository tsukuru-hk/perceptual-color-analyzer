import { ref, shallowRef, computed } from 'vue'
import type { ColorSpace, ColorAwareImageData } from '@/domain/colorSpace'
import type { AnalysisKey, AnalysisResult, AnalysisError } from '@/types/analysis'
import type { AnalysisParams } from '@/infrastructure/analysisWorkerProtocol'
import { isAnalysisError } from '@/types/analysis'
import { loadImageUseCase } from '@/application/useCase/loadImageUseCase'
import { requestAnalysis, cancelByImageId } from '@/infrastructure/analysisWorkerClient'
import { determineWorkingColorSpace } from '@/infrastructure/displayCapabilityDetector'
import { useToast } from '@/composables/useToast'

/** ギャラリーに保持する画像の上限（タブ過多・メモリを抑える） */
const MAX_IMAGES = 5

/** 1枚分の読み込み結果（サムネ用 object URL を含む） */
export interface ImageEntry {
  id: string
  colorAwareImageData: ColorAwareImageData
  fileName: string
  thumbnailUrl: string
}

const images = ref<ImageEntry[]>([])
const selectedId = ref<string | null>(null)
const loadProgress = ref<'idle' | 'loading' | 'done' | 'error'>('idle')

/** 画像ID → 分析種別 → 結果 の reactive キャッシュ */
const analysisCacheMap = shallowRef(new Map<string, Partial<AnalysisResult>>())

/** 処理中の分析を追跡する Set（"imageId::analysisKey" 形式） */
const inFlightSet = shallowRef(new Set<string>())

/** 起動時に一度だけ判定する作業色空間 */
const workingColorSpace = ref<ColorSpace>(determineWorkingColorSpace())

const selectedImage = computed(() =>
  images.value.find((img) => img.id === selectedId.value) ?? null,
)

const colorAwareImageData = computed(() => selectedImage.value?.colorAwareImageData ?? null)
const canAddMore = computed(() => images.value.length < MAX_IMAGES)

function inFlightKey(imageId: string, key: AnalysisKey): string {
  return `${imageId}::${key}`
}

function setCacheEntry<K extends AnalysisKey>(imageId: string, key: K, value: AnalysisResult[K]) {
  const newMap = new Map(analysisCacheMap.value)
  const entry = { ...(newMap.get(imageId) ?? {}), [key]: value }
  newMap.set(imageId, entry)
  analysisCacheMap.value = newMap
}

function deleteCacheEntry(imageId: string) {
  const newMap = new Map(analysisCacheMap.value)
  newMap.delete(imageId)
  analysisCacheMap.value = newMap
}

/**
 * ImageData から object URL 用の Blob を生成する。
 * @param data サムネイル元のピクセルデータ
 */
function generateThumbnailUrl(data: ImageData): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = data.width
    canvas.height = data.height
    canvas.getContext('2d')!.putImageData(data, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) resolve(URL.createObjectURL(blob))
      else reject(new Error('Failed to generate thumbnail'))
    })
  })
}

/**
 * 分析ページで共有する画像ギャラリー状態。
 * 読み込み・選択・削除とサムネ object URL の解放をまとめて扱う。
 */
export function useImageStore() {
  const { toast } = useToast()

  /**
   * 画像を1枚追加し、選択中 ID をその画像にする。
   * @param file ブラウザで選ばれた画像ファイル
   */
  async function addImage(file: File) {
    if (!canAddMore.value) {
      toast({ title: `最大${MAX_IMAGES}枚までです`, variant: 'error' })
      return
    }

    loadProgress.value = 'loading'

    const result = await loadImageUseCase(file, workingColorSpace.value)

    if (result.isFailure()) {
      toast({ title: 'エラー', description: result.error.message, variant: 'error' })
      loadProgress.value = 'error'
      return
    }

    let thumbnailUrl: string
    try {
      thumbnailUrl = await generateThumbnailUrl(result.value.imageData)
    } catch {
      toast({ title: 'サムネイル生成に失敗しました', variant: 'error' })
      loadProgress.value = 'error'
      return
    }
    const entry: ImageEntry = {
      id: crypto.randomUUID(),
      colorAwareImageData: result.value,
      fileName: file.name,
      thumbnailUrl,
    }

    images.value = [...images.value, entry]
    selectedId.value = entry.id
    loadProgress.value = 'done'
    toast({ title: '画像を読み込みました', variant: 'success' })
  }

  /**
   * 指定画像・指定種別の分析結果を取得する。
   * キャッシュにあれば即返す。なければ Worker に依頼し null を返す。
   * Worker 完了時に reactive キャッシュが更新され、再レンダーでキャッシュヒットする。
   */
  function getAnalysis<K extends AnalysisKey>(imageId: string, source: ColorAwareImageData, key: K, params?: AnalysisParams): AnalysisResult[K] | null {
    const cache = analysisCacheMap.value.get(imageId)
    if (cache && key in cache) {
      return cache[key] as AnalysisResult[K]
    }

    const k = inFlightKey(imageId, key)
    if (inFlightSet.value.has(k)) {
      return null
    }

    // Worker に dispatch
    const nextInFlight = new Set(inFlightSet.value)
    nextInFlight.add(k)
    inFlightSet.value = nextInFlight

    const { promise } = requestAnalysis(imageId, key, source, params)

    promise.then((response) => {
      // in-flight から削除
      const updated = new Set(inFlightSet.value)
      updated.delete(k)
      inFlightSet.value = updated

      if (response.status === 'success') {
        if (response.imageData) {
          setCacheEntry(imageId, key, response.imageData as AnalysisResult[K])
        } else if (response.histogramData) {
          setCacheEntry(imageId, key, response.histogramData as AnalysisResult[K])
        } else if (response.gamutPointCloudData) {
          setCacheEntry(imageId, key, response.gamutPointCloudData as AnalysisResult[K])
        } else if (response.colorClusterData) {
          setCacheEntry(imageId, key, response.colorClusterData as AnalysisResult[K])
        }
      } else {
        // エラー状態をキャッシュに保存（無限スピナーを防止）
        const error: AnalysisError = {
          _tag: 'AnalysisError',
          analysisKey: key,
          message: response.errorMessage ?? '分析処理に失敗しました',
        }
        setCacheEntry(imageId, key, error as unknown as AnalysisResult[K])
      }
    })

    return null
  }

  /** 指定の分析が処理中かどうかを返す */
  function isAnalysisLoading(imageId: string, key: AnalysisKey): boolean {
    return inFlightSet.value.has(inFlightKey(imageId, key))
  }

  /** エラーになった分析をキャッシュから削除し、再取得を促す */
  function retryAnalysis(imageId: string, key: AnalysisKey): void {
    const cache = analysisCacheMap.value.get(imageId)
    if (cache && key in cache && isAnalysisError(cache[key])) {
      invalidateAnalysis(imageId, key)
    }
  }

  /** 指定分析のキャッシュを無効化し、次回 getAnalysis で再計算を促す */
  function invalidateAnalysis(imageId: string, key: AnalysisKey): void {
    const cache = analysisCacheMap.value.get(imageId)
    if (cache && key in cache) {
      const newMap = new Map(analysisCacheMap.value)
      const entry = { ...newMap.get(imageId)! }
      delete entry[key]
      newMap.set(imageId, entry)
      analysisCacheMap.value = newMap
    }
    // in-flight も削除して再リクエスト可能にする
    const k = inFlightKey(imageId, key)
    if (inFlightSet.value.has(k)) {
      const updated = new Set(inFlightSet.value)
      updated.delete(k)
      inFlightSet.value = updated
    }
  }

  /**
   * 指定 ID の画像を削除し、サムネ URL を revoke する。
   * @param id `ImageEntry.id`
   */
  function removeImage(id: string) {
    const index = images.value.findIndex((img) => img.id === id)
    if (index === -1) return

    const removed = images.value[index]
    if (!removed) return
    URL.revokeObjectURL(removed.thumbnailUrl)
    deleteCacheEntry(id)
    cancelByImageId(id)

    // inFlightSet からも該当エントリを削除
    const nextInFlight = new Set(inFlightSet.value)
    for (const k of nextInFlight) {
      if (k.startsWith(`${id}::`)) nextInFlight.delete(k)
    }
    inFlightSet.value = nextInFlight

    const next = [...images.value]
    next.splice(index, 1)
    images.value = next

    if (selectedId.value === id) {
      selectedId.value =
        next[Math.min(index, next.length - 1)]?.id ?? null
    }
  }

  /** 表示・分析対象とする画像を切り替える。 */
  function selectImage(id: string) {
    selectedId.value = id
  }

  /** 全画像を破棄し、状態を初期化する。 */
  function clear() {
    for (const img of images.value) {
      URL.revokeObjectURL(img.thumbnailUrl)
      cancelByImageId(img.id)
    }
    analysisCacheMap.value = new Map()
    inFlightSet.value = new Set()
    images.value = []
    selectedId.value = null
    loadProgress.value = 'idle'
  }

  return {
    images,
    selectedId,
    selectedImage,
    getAnalysis,
    isAnalysisLoading,
    isAnalysisError,
    retryAnalysis,
    invalidateAnalysis,
    colorAwareImageData,
    canAddMore,
    loadProgress,
    workingColorSpace,
    addImage,
    removeImage,
    selectImage,
    clear,
  }
}
