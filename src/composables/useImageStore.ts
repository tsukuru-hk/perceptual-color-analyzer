import { ref, computed } from 'vue'
import { loadImageUseCase } from '@/application/useCase/loadImageUseCase'
import { useToast } from '@/composables/useToast'

/** ギャラリーに保持する画像の上限（タブ過多・メモリを抑える） */
const MAX_IMAGES = 5

/** 1枚分の読み込み結果（サムネ用 object URL を含む） */
export interface ImageEntry {
  id: string
  imageData: ImageData
  fileName: string
  thumbnailUrl: string
}

const images = ref<ImageEntry[]>([])
const selectedId = ref<string | null>(null)
const loadProgress = ref<'idle' | 'loading' | 'done' | 'error'>('idle')

const selectedImage = computed(() =>
  images.value.find((img) => img.id === selectedId.value) ?? null,
)

const imageData = computed(() => selectedImage.value?.imageData ?? null)
const canAddMore = computed(() => images.value.length < MAX_IMAGES)

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

    const result = await loadImageUseCase(file, { maxWidth: 800, maxHeight: 600 })

    if (result.isFailure()) {
      toast({ title: 'エラー', description: result.error.message, variant: 'error' })
      loadProgress.value = 'error'
      return
    }

    const thumbnailUrl = await generateThumbnailUrl(result.value)
    const entry: ImageEntry = {
      id: crypto.randomUUID(),
      imageData: result.value,
      fileName: file.name,
      thumbnailUrl,
    }

    images.value = [...images.value, entry]
    selectedId.value = entry.id
    loadProgress.value = 'done'
    toast({ title: '画像を読み込みました', variant: 'success' })
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
    }
    images.value = []
    selectedId.value = null
    loadProgress.value = 'idle'
  }

  return {
    images,
    selectedId,
    selectedImage,
    imageData,
    canAddMore,
    loadProgress,
    addImage,
    removeImage,
    selectImage,
    clear,
  }
}
