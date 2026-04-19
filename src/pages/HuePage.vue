<template>
  <!-- ページ：色相分析 — 3D地形 + 2Dガマットマップ -->
  <AnalysisPageLayout
    title="色相分析"
    description="色相環上のガマット分布と各色相の支配率を可視化"
    :placeholder-icon="Rainbow"
    placeholder-text="画像をアップロードすると色相の分布が表示されます"
    :split-pane="true"
    pane-height="h-[calc(100vh-13rem)]"
  >
    <template #default>
      <AnalysisErrorCard
        v-if="hueError"
        :message="hueError.message"
        @retry="retryAnalysis(imageId, 'hueAnalysis')"
      />
      <template v-else-if="hueResult">
        <!-- 右ペイン全体を 3D 地形チャートで埋める -->
        <HueTerrainChart
          :data="hueResult"
          :active-band="activeBand"
          :log-scale="logScale"
          class="h-full w-full"
        />
        <!-- オーバーレイ UI 左上 -->
        <div class="absolute left-3 top-3 z-10 flex flex-col gap-2">
          <LightnessBandToggle v-model="activeBand" />
          <LightnessBandPreview
            v-if="selectedImage"
            :source="selectedImage.colorAwareImageData"
            :active-band="activeBand"
            class="shadow-md"
          />
        </div>
        <!-- オーバーレイ UI 右上: Log トグル -->
        <div class="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/40 px-2 py-1 backdrop-blur-sm">
          <span class="text-[10px] text-white/70 select-none">Log</span>
          <Toggle v-model="logScale" />
        </div>
      </template>
      <AnalysisSpinner v-else />
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Rainbow } from 'lucide-vue-next'
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { AnalysisSpinner, AnalysisErrorCard, Toggle } from '@/components/ui'
import { HueTerrainChart, LightnessBandPreview, LightnessBandToggle } from '@/features/hue-analysis'
import { isAnalysisError } from '@/types/analysis'
import type { HueAnalysisResult } from '@/types/hueAnalysis'
import { useImageStore } from '@/composables/useImageStore'

const { selectedImage, getAnalysis, retryAnalysis } = useImageStore()

const imageId = computed(() => selectedImage.value?.id ?? '')

const activeBand = ref<'all' | 'dark' | 'mid' | 'light'>('all')
const logScale = ref(false)

// 色相分析
const rawHueResult = computed(() => {
  const id = imageId.value
  const source = selectedImage.value?.colorAwareImageData
  if (!id || !source) return null
  return getAnalysis(id, source, 'hueAnalysis')
})

const hueError = computed(() =>
  isAnalysisError(rawHueResult.value) ? rawHueResult.value : null,
)

const hueResult = computed<HueAnalysisResult | null>(() => {
  const r = rawHueResult.value
  return r != null && !isAnalysisError(r) ? r : null
})

// 支配的な色相のラベル
const HUE_NAMES: [number, string][] = [
  [15, '赤'], [45, '橙'], [75, '黄'], [105, '黄緑'],
  [135, '緑'], [165, '青緑'], [195, '青緑'], [225, '青'],
  [255, '青紫'], [285, '紫'], [315, '赤紫'], [345, '赤'],
]

const dominantHue = computed(() => {
  const sectors = hueResult.value?.sectors
  if (!sectors || sectors.length === 0) return null
  const max = sectors.reduce((a, b) => (a.ratio > b.ratio ? a : b))
  if (max.ratio === 0) return null
  const center = (max.hueStart + max.hueEnd) / 2
  const name = HUE_NAMES.find(([boundary]) => center < boundary)?.[1] ?? '赤'
  return `${name} (${Math.round(center)}°, ${(max.ratio * 100).toFixed(1)}%)`
})
</script>
