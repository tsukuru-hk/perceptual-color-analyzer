<template>
  <AnalysisPageLayout
    title="3D ガマット"
    description="OKLCH 色空間での 3D ポイントクラウド可視化"
    :placeholder-icon="Box"
    placeholder-text="画像をアップロードすると OKLCH 色空間上の 3D ガマットマップが表示されます"
    :split-pane="true"
    pane-height="h-[calc(100vh-13rem)]"
  >
    <template #default="{ colorAwareImageData }">
      <AnalysisErrorCard v-if="isAnalysisError(pointCloud(colorAwareImageData))" :message="pointCloud(colorAwareImageData)!.message" @retry="retryAnalysis(selectedImage!.id, 'gamutPointCloud')" />
      <GamutScene
        v-else-if="pointCloud(colorAwareImageData)"
        :point-cloud-data="pointCloud(colorAwareImageData)!"
        :color-space="colorAwareImageData.colorSpace"
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
import { useImageStore } from '@/composables/useImageStore'

const { selectedImage, getAnalysis, retryAnalysis } = useImageStore()

function pointCloud(source: ColorAwareImageData) {
  return selectedImage.value
    ? getAnalysis(selectedImage.value.id, source, 'gamutPointCloud')
    : null
}
</script>
