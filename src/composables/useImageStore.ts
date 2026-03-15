import { ref, readonly } from 'vue'
import { loadImageUseCase } from '@/application/useCase/loadImageUseCase'
import { useToast } from '@/composables/useToast'

const imageData = ref<ImageData | null>(null)
const fileName = ref<string | null>(null)
const loadProgress = ref<'idle' | 'loading' | 'done' | 'error'>('idle')

export function useImageStore() {
  const { toast } = useToast()

  async function loadImage(file: File) {
    loadProgress.value = 'loading'
    fileName.value = file.name

    const result = await loadImageUseCase(file, { maxWidth: 800, maxHeight: 600 })

    if (result.isFailure()) {
      toast({ title: 'エラー', description: result.error.message, variant: 'error' })
      loadProgress.value = 'error'
      imageData.value = null
      return
    }

    imageData.value = result.value
    loadProgress.value = 'done'
    toast({ title: '画像を読み込みました', variant: 'success' })
  }

  function clear() {
    imageData.value = null
    fileName.value = null
    loadProgress.value = 'idle'
  }

  return {
    imageData: readonly(imageData),
    fileName: readonly(fileName),
    loadProgress: readonly(loadProgress),
    loadImage,
    clear,
  }
}
