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
          :brush-mode="brushMode"
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
        :show-bulk-cloud="showBulkCloud"
        :brush-mode="brushMode"
        :brush-data="brushData"
        @toggle-bulk="toggleBulkCloud"
        @toggle-brush="toggleBrushMode"
        @clear-brush="clearBrushPoints"
      />
      <AnalysisSpinner v-else />
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { Box } from 'lucide-vue-next'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import { AnalysisPageLayout, AnalysisSpinner, AnalysisErrorCard } from '@/components/ui'
import { isAnalysisError } from '@/types/analysis'
import { GamutScene } from '@/features/gamut-3d'
import GamutBrushOverlay from '@/features/gamut-3d/GamutBrushOverlay.vue'
import ImageCanvas from '@/features/image-analysis/ImageCanvas.vue'
import { useImageStore } from '@/composables/useImageStore'
import { useGamutBrush } from '@/features/gamut-3d/composables/useGamutBrush'

const { selectedImage, getAnalysis, retryAnalysis } = useImageStore()

const {
  showBulkCloud,
  brushMode,
  brushData,
  addBrushPoints,
  clearBrushPoints,
  toggleBrushMode,
  toggleBulkCloud,
} = useGamutBrush()

function pointCloud(source: ColorAwareImageData) {
  return selectedImage.value
    ? getAnalysis(selectedImage.value.id, source, 'gamutPointCloud')
    : null
}
</script>
