<template>
  <AnalysisPageLayout
    title="3D ガマット"
    description="OKLCH 色空間での 3D ポイントクラウド可視化"
    :placeholder-icon="Box"
    placeholder-text="画像をアップロードすると OKLCH 色空間上の 3D ガマットマップが表示されます"
    :split-pane="true"
    pane-height="h-[calc(100vh-13rem)]"
  >
    <template #left="{ colorAwareImageData }">
      <div class="relative">
        <ImageCanvas :image-data="colorAwareImageData.imageData" />
        <GamutBrushOverlay
          :image-data="colorAwareImageData.imageData"
          :color-space="colorAwareImageData.colorSpace"
          :brush-mode="isBrush"
          @stroke-start="beginStroke"
          @stroke-end="endStroke"
          @brush-stroke="addBrushPoints"
        />
      </div>
    </template>
    <template #default="{ colorAwareImageData }">
      <AnalysisErrorCard v-if="isAnalysisError(pointCloud(colorAwareImageData))" :message="pointCloud(colorAwareImageData)!.message" @retry="retryAnalysis(selectedImage!.id, 'gamutPointCloud')" />
      <GamutScene
        v-else-if="pointCloud(colorAwareImageData)"
        :point-cloud-data="pointCloud(colorAwareImageData)!"
        :color-space="colorAwareImageData.colorSpace"
        :mode="mode"
        :brush-data="brushData"
        @set-mode="setMode"
        @clear-brush="clearBrushPoints"
      />
      <AnalysisSpinner v-else />
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue'
import { Box } from 'lucide-vue-next'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import { AnalysisPageLayout, AnalysisSpinner, AnalysisErrorCard } from '@/components/ui'
import { isAnalysisError } from '@/types/analysis'
import GamutBrushOverlay from '@/features/gamut-3d/GamutBrushOverlay.vue'
import ImageCanvas from '@/features/image-analysis/ImageCanvas.vue'
import { useImageStore } from '@/composables/useImageStore'
import { useToast } from '@/composables/useToast'
import {
  useGamutBrush,
  MAX_BRUSH_POINTS,
} from '@/features/gamut-3d/composables/useGamutBrush'

const GamutScene = defineAsyncComponent(() =>
  import('@/features/gamut-3d/GamutScene.vue'),
)

const { selectedImage, images, getAnalysis, retryAnalysis } = useImageStore()
const { toast } = useToast()

const imageId = computed(() => selectedImage.value?.id ?? '')

const {
  mode,
  isBrush,
  brushData,
  setMode,
  addBrushPoints,
  clearBrushPoints,
  beginStroke,
  endStroke,
  forgetImage,
  setOnLimitReached,
} = useGamutBrush(imageId)

// 上限到達時のトースト通知（1 ストローク中の連続通知を 1 回に抑制）
let limitToastShown = false
setOnLimitReached(() => {
  if (limitToastShown) return
  limitToastShown = true
  toast({
    title: `ブラシ点は最大 ${MAX_BRUSH_POINTS.toLocaleString()} 点です`,
    description: 'リセットしてから続けてください。',
    variant: 'info',
  })
})

// 画像が切り替わるたびに上限トーストフラグをリセット
watch(imageId, () => {
  limitToastShown = false
})

// 画像削除時に対応するブラシ状態を破棄（メモリ解放）
watch(images, (current, prev) => {
  if (!prev) return
  const currentIds = new Set(current.map((img) => img.id))
  for (const old of prev) {
    if (!currentIds.has(old.id)) forgetImage(old.id)
  }
}, { deep: false })

function pointCloud(source: ColorAwareImageData) {
  return selectedImage.value
    ? getAnalysis(selectedImage.value.id, source, 'gamutPointCloud')
    : null
}
</script>
