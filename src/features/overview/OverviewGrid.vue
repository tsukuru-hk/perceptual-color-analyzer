<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <!-- Row 1: オリジナル画像 -->
    <OverviewCard
      title="オリジナル画像"
      to="/"
      :loading="false"
      :error="false"
    >
      <ImageCanvas :image-data="colorAwareImageData.imageData" />
    </OverviewCard>

    <!-- Row 1: 明度グレースケール -->
    <OverviewCard
      title="明度グレースケール"
      to="/lightness"
      :loading="lightnessLoading"
      :error="lightnessError"
      @retry="retryAnalysis(imageId, 'lightnessMap')"
    >
      <ImageCanvas v-if="lightnessMapData" :image-data="lightnessMapData" />
    </OverviewCard>

    <!-- Row 1: 彩度グレースケール -->
    <OverviewCard
      title="彩度グレースケール"
      to="/chroma"
      :loading="chromaLoading"
      :error="chromaError"
      @retry="retryAnalysis(imageId, 'chromaMap')"
    >
      <ImageCanvas v-if="chromaMapData" :image-data="chromaMapData" />
    </OverviewCard>

    <!-- Row 2: 色相テレイン -->
    <OverviewCard
      ref="hueCardRef"
      title="色相分析"
      to="/hue"
      :loading="hueLoading"
      :error="hueError"
      @retry="retryAnalysis(imageId, 'hueAnalysis')"
    >
      <div v-if="hueData && row2Visible" class="h-full w-full">
        <HueTerrainChart
          :data="hueData"
          active-band="all"
          :log-scale="false"
          class="h-full w-full"
        />
      </div>
    </OverviewCard>

    <!-- Row 2: 3D ガマット -->
    <OverviewCard
      title="3D ガマット"
      to="/gamut"
      :loading="gamutLoading"
      :error="gamutError"
      @retry="retryAnalysis(imageId, 'gamutPointCloud')"
    >
      <div v-if="gamutData && row2Visible" class="h-full w-full">
        <GamutScene
          :point-cloud-data="gamutData"
          :color-space="colorAwareImageData.colorSpace"
          mode="bulk"
          :brush-data="EMPTY_BRUSH_DATA"
        />
      </div>
    </OverviewCard>

    <!-- Row 2: 色分布 -->
    <OverviewCard
      title="色分布"
      to="/distribution"
      :loading="clusterLoading"
      :error="clusterError"
      @retry="retryAnalysis(imageId, 'colorClustering')"
    >
      <div v-if="clusterData && row2Visible" class="h-full w-full flex items-center justify-center">
        <ClusterBubbleChart :data="clusterData" :height="200" />
      </div>
    </OverviewCard>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import type { GamutPointCloudData } from '@/types/analysis'
import type { HueAnalysisResult } from '@/types/hueAnalysis'
import type { ColorClusterResult } from '@/domain/colorCluster'
import { isAnalysisError } from '@/types/analysis'
import { useImageStore } from '@/composables/useImageStore'
import ImageCanvas from '@/features/image-analysis/ImageCanvas.vue'
import OverviewCard from './OverviewCard.vue'

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

/** GamutScene に渡す空のブラシデータ */
const EMPTY_BRUSH_DATA: GamutPointCloudData = {
  positions: new Float32Array(0),
  colors: new Float32Array(0),
  count: 0,
  totalPixels: 0,
}

// ─── IntersectionObserver: Row 2 の描画をビューポート内に限定 ───

const hueCardRef = ref<InstanceType<typeof OverviewCard> | null>(null)
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
    { rootMargin: '100px' },
  )
  // hueCardRef は OverviewCard コンポーネント。$el で DOM 要素取得
  const el = (hueCardRef.value as unknown as { $el: HTMLElement })?.$el
  if (el) observer.observe(el)
})

onUnmounted(() => {
  observer?.disconnect()
})

// ─── 解析リクエスト: 優先順に呼び出し（Worker 逐次処理のため順序が重要） ───

// Row 1: 軽量解析を先に
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

// Row 2: 重い解析は後
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

// ─── データ抽出（エラーを除外） ───

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

// ─── Loading / Error 状態 ───

const lightnessLoading = computed(() => isAnalysisLoading(imageId.value, 'lightnessMap'))
const chromaLoading = computed(() => isAnalysisLoading(imageId.value, 'chromaMap'))
const hueLoading = computed(() => isAnalysisLoading(imageId.value, 'hueAnalysis'))
const gamutLoading = computed(() => isAnalysisLoading(imageId.value, 'gamutPointCloud'))
const clusterLoading = computed(() => isAnalysisLoading(imageId.value, 'colorClustering'))

const lightnessError = computed(() => isAnalysisError(rawLightnessMap.value))
const chromaError = computed(() => isAnalysisError(rawChromaMap.value))
const hueError = computed(() => isAnalysisError(rawHueResult.value))
const gamutError = computed(() => isAnalysisError(rawGamutCloud.value))
const clusterError = computed(() => isAnalysisError(rawClusterResult.value))
</script>
