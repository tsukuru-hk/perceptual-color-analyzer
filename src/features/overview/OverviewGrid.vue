<template>
  <div class="space-y-6">
    <!-- Row 1: オリジナル / 明度 / 彩度 -->
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <h3 class="mb-2 text-sm font-medium text-muted-foreground">オリジナル画像</h3>
        <ImageCanvas :image-data="colorAwareImageData.imageData" />
      </div>

      <div>
        <h3 class="mb-2 text-sm font-medium text-muted-foreground">明度グレースケール</h3>
        <AnalysisErrorCard v-if="lightnessError" :message="lightnessErrorMsg" @retry="retryAnalysis(imageId, 'lightnessMap')" />
        <ImageCanvas v-else-if="lightnessMapData" :image-data="lightnessMapData" />
        <AnalysisSpinner v-else />
      </div>

      <div>
        <h3 class="mb-2 text-sm font-medium text-muted-foreground">彩度グレースケール</h3>
        <AnalysisErrorCard v-if="chromaError" :message="chromaErrorMsg" @retry="retryAnalysis(imageId, 'chromaMap')" />
        <ImageCanvas v-else-if="chromaMapData" :image-data="chromaMapData" />
        <AnalysisSpinner v-else />
      </div>
    </div>

    <!-- Row 2: 色相 / 3D ガマット / 色分布 -->
    <div ref="row2Ref" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <h3 class="mb-2 text-sm font-medium text-muted-foreground">色相分析</h3>
        <AnalysisErrorCard v-if="hueError" :message="hueErrorMsg" @retry="retryAnalysis(imageId, 'hueAnalysis')" />
        <div v-else-if="hueData && row2Visible" class="relative h-[320px] overflow-hidden rounded-lg">
          <HueTerrainChart
            :data="hueData"
            active-band="all"
            :log-scale="false"
            class="h-full w-full"
          />
        </div>
        <AnalysisSpinner v-else />
      </div>

      <div>
        <h3 class="mb-2 text-sm font-medium text-muted-foreground">3D ガマット</h3>
        <AnalysisErrorCard v-if="gamutError" :message="gamutErrorMsg" @retry="retryAnalysis(imageId, 'gamutPointCloud')" />
        <div v-else-if="gamutData && row2Visible" class="relative h-[320px] overflow-hidden rounded-lg">
          <GamutScene
            :point-cloud-data="gamutData"
            :color-space="colorAwareImageData.colorSpace"
            mode="bulk"
            :brush-data="EMPTY_BRUSH_DATA"
            :show-toolbar="false"
          />
        </div>
        <AnalysisSpinner v-else />
      </div>

      <div>
        <h3 class="mb-2 text-sm font-medium text-muted-foreground">色分布</h3>
        <AnalysisErrorCard v-if="clusterError" :message="clusterErrorMsg" @retry="retryAnalysis(imageId, 'colorClustering')" />
        <div v-else-if="clusterData && row2Visible">
          <ClusterBubbleChart :data="clusterData" :height="320" />
        </div>
        <AnalysisSpinner v-else />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import type { GamutPointCloudData, AnalysisError } from '@/types/analysis'
import type { HueAnalysisResult } from '@/types/hueAnalysis'
import type { ColorClusterResult } from '@/domain/colorCluster'
import { isAnalysisError } from '@/types/analysis'
import { useImageStore } from '@/composables/useImageStore'
import { AnalysisSpinner, AnalysisErrorCard } from '@/components/ui'
import ImageCanvas from '@/features/image-analysis/ImageCanvas.vue'

const HueTerrainChart = defineAsyncComponent(() =>
  import('@/features/hue-analysis/HueTerrainChart.vue'),
)
const GamutScene = defineAsyncComponent(() =>
  import('@/features/gamut-3d/GamutScene.vue'),
)
const ClusterBubbleChart = defineAsyncComponent(() =>
  import('@/features/color-cluster/ClusterBubbleChart.vue'),
)

const props = defineProps<{
  colorAwareImageData: ColorAwareImageData
}>()

const { selectedImage, getAnalysis, isAnalysisLoading, retryAnalysis } = useImageStore()

const imageId = computed(() => selectedImage.value?.id ?? '')

const EMPTY_BRUSH_DATA: GamutPointCloudData = {
  positions: new Float32Array(0),
  colors: new Float32Array(0),
  count: 0,
  totalPixels: 0,
}

// ─── IntersectionObserver: Row 2 の描画をビューポート到達まで遅延 ───

const row2Ref = ref<HTMLElement | null>(null)
const row2Visible = ref(false)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          row2Visible.value = true
          observer?.disconnect()
          observer = null
          break
        }
      }
    },
    { rootMargin: '200px' },
  )
  if (row2Ref.value) observer.observe(row2Ref.value)
})

onUnmounted(() => {
  observer?.disconnect()
})

// ─── 解析リクエスト: 優先順に呼び出し ───

const rawLightnessMap = computed(() => {
  const id = imageId.value
  if (!id) return null
  return getAnalysis(id, props.colorAwareImageData, 'lightnessMap')
})

const rawChromaMap = computed(() => {
  const id = imageId.value
  if (!id) return null
  return getAnalysis(id, props.colorAwareImageData, 'chromaMap')
})

const rawHueResult = computed(() => {
  const id = imageId.value
  if (!id) return null
  return getAnalysis(id, props.colorAwareImageData, 'hueAnalysis')
})

const rawGamutCloud = computed(() => {
  const id = imageId.value
  if (!id) return null
  return getAnalysis(id, props.colorAwareImageData, 'gamutPointCloud')
})

const rawClusterResult = computed(() => {
  const id = imageId.value
  if (!id) return null
  return getAnalysis(id, props.colorAwareImageData, 'colorClustering')
})

// ─── データ抽出 ───

const lightnessMapData = computed<ImageData | null>(() => {
  const r = rawLightnessMap.value
  return r && !isAnalysisError(r) ? r : null
})

const chromaMapData = computed<ImageData | null>(() => {
  const r = rawChromaMap.value
  return r && !isAnalysisError(r) ? r : null
})

const hueData = computed<HueAnalysisResult | null>(() => {
  const r = rawHueResult.value
  return r && !isAnalysisError(r) ? r : null
})

const gamutData = computed<GamutPointCloudData | null>(() => {
  const r = rawGamutCloud.value
  return r && !isAnalysisError(r) ? r : null
})

const clusterData = computed<ColorClusterResult | null>(() => {
  const r = rawClusterResult.value
  return r && !isAnalysisError(r) ? r : null
})

// ─── Error 状態 ───

const lightnessError = computed(() => isAnalysisError(rawLightnessMap.value))
const chromaError = computed(() => isAnalysisError(rawChromaMap.value))
const hueError = computed(() => isAnalysisError(rawHueResult.value))
const gamutError = computed(() => isAnalysisError(rawGamutCloud.value))
const clusterError = computed(() => isAnalysisError(rawClusterResult.value))

const lightnessErrorMsg = computed(() => (rawLightnessMap.value as AnalysisError)?.message ?? '')
const chromaErrorMsg = computed(() => (rawChromaMap.value as AnalysisError)?.message ?? '')
const hueErrorMsg = computed(() => (rawHueResult.value as AnalysisError)?.message ?? '')
const gamutErrorMsg = computed(() => (rawGamutCloud.value as AnalysisError)?.message ?? '')
const clusterErrorMsg = computed(() => (rawClusterResult.value as AnalysisError)?.message ?? '')
</script>
