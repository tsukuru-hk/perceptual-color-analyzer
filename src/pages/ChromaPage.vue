<template>
  <!-- ページ：彩度 — Chroma をグレースケール可視化 -->
  <AnalysisPageLayout
    title="彩度分析"
    description="OKLCH Chroma チャンネルの詳細分析"
    :placeholder-icon="Droplets"
    placeholder-text="画像をアップロードすると彩度のグレースケールマップと分布が表示されます"
  >
    <template #default="{ colorAwareImageData }">
      <div class="space-y-4">
        <div>
          <h3 class="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            彩度グレースケール
            <InfoTooltip content="OKLCH の Chroma 値を 0〜1 に正規化し、グレースケールで可視化したものです。白いほど彩度が高く、黒いほど無彩色に近いことを示します。" />
          </h3>
          <AnalysisErrorCard v-if="isAnalysisError(chromaMap(colorAwareImageData))" :message="chromaMap(colorAwareImageData)!.message" @retry="retryAnalysis(selectedImage!.id, 'chromaMap')" />
          <ChromaMapPanel v-else-if="chromaMap(colorAwareImageData)" :chroma-map-data="chromaMap(colorAwareImageData)!" />
          <AnalysisSpinner v-else />
        </div>
        <div>
          <h3 class="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            彩度ヒストグラム
            <InfoTooltip content="画像内の全ピクセルの OKLCH Chroma 値の分布を示すヒストグラムです。横軸が彩度、縦軸がピクセル数を表します。" />
            <span class="ml-auto flex items-center gap-1 scale-75 origin-right">
              <span class="text-[10px] text-muted-foreground select-none">Log</span>
              <Toggle v-model="chromaLogScale" />
            </span>
          </h3>
          <AnalysisErrorCard v-if="isAnalysisError(chromaHistogram(colorAwareImageData))" :message="chromaHistogram(colorAwareImageData)!.message" @retry="retryAnalysis(selectedImage!.id, 'chromaHistogram')" />
          <ChromaHistogramPanel v-else-if="chromaHistogram(colorAwareImageData)" :histogram-data="chromaHistogram(colorAwareImageData)!" :log-scale="chromaLogScale" />
          <AnalysisSpinner v-else />
        </div>
        <div>
          <Legend
            title="Chroma (彩度)"
            min-label="0 (無彩色)"
            max-label="0.4+ (高彩度)"
gradient="linear-gradient(to right, oklch(0.55 0 0), oklch(0.84 0.4 145))"
          />
        </div>
      </div>
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Droplets } from 'lucide-vue-next'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { Legend, InfoTooltip, Toggle, AnalysisSpinner, AnalysisErrorCard } from '@/components/ui'
import { isAnalysisError } from '@/types/analysis'
import { ChromaMapPanel, ChromaHistogramPanel } from '@/features/grayscale-map'
import { useImageStore } from '@/composables/useImageStore'

const { selectedImage, getAnalysis, retryAnalysis } = useImageStore()
const chromaLogScale = ref(false)

function chromaMap(source: ColorAwareImageData) {
  return selectedImage.value ? getAnalysis(selectedImage.value.id, source, 'chromaMap') : null
}
function chromaHistogram(source: ColorAwareImageData) {
  return selectedImage.value ? getAnalysis(selectedImage.value.id, source, 'chromaHistogram') : null
}
</script>
