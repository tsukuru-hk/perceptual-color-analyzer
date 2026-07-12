<template>
  <AnalysisPageLayout
    title="3D ガマット"
    description="画像に含まれるすべての色を3D空間にマッピングし、配色の広がりや偏りを立体的に確認できます"
    placeholder-text="画像をアップロードすると3Dマッピングが表示されます"
    :split-pane="true"
    pane-height="h-[calc(100vh-13rem)]"
  >
    <template #title-icon>
      <img src="@/assets/3D-icon.png" alt="" class="h-14 w-14" />
    </template>
    <template #explanation="{ close }">
      <ExplanationContent
        title="3D ガマット"
        :sections="explanationSections"
        @close="close"
      >
        <template #icon>
          <img src="@/assets/3D-icon.png" alt="" class="h-8 w-8" />
        </template>
      </ExplanationContent>
    </template>
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
    <template #default>
      <AnalysisErrorCard v-if="pointCloudError" :message="pointCloudError.message" @retry="retryPointCloud" />
      <template v-else-if="pointCloudResult">
        <GamutScene
          ref="gamutSceneRef"
          v-model:show-chrome="showChrome"
          :point-cloud-data="pointCloudResult"
          :mode="mode"
          :brush-data="brushData"
          :persist-camera="true"
          @set-mode="setMode"
          @clear-brush="clearBrushPoints"
        />
        <!-- 分析タイトル（中央左）: 明度ガイドと重ならないよう中央を空ける -->
        <span v-if="showChrome" class="absolute right-[calc(50%+4rem)] top-3 z-10 rounded-lg border border-white/20 bg-black/40 px-3 py-1 text-sm font-semibold text-white/90 backdrop-blur-sm">3Dガマット</span>
        <!-- PNG / CSV ダウンロード（中央右） -->
        <div v-if="showChrome" class="absolute left-[calc(50%+4rem)] top-3 z-10 flex items-center gap-2">
          <DownloadButton variant="overlay" :disabled="isExporting" @click="downloadGamut3d" />
          <DataDownloadButton
            variant="overlay"
            label="CSV"
            title="3D点群を CSV でダウンロード（AIに3D構造を解析させる用）"
            :disabled="isDataExporting"
            @click="downloadGamutData"
          />
        </div>
      </template>
      <AnalysisSpinner v-else />
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { AnalysisPageLayout, AnalysisSpinner, AnalysisErrorCard, ExplanationContent, DownloadButton, DataDownloadButton } from '@/components/ui'
import type { ExplanationSection } from '@/components/ui'
import GamutBrushOverlay from '@/features/gamut-3d/GamutBrushOverlay.vue'
import ImageCanvas from '@/features/image-analysis/ImageCanvas.vue'
import { useImageStore } from '@/composables/useImageStore'
import { useAnalysisResult } from '@/composables/useAnalysisResult'
import { useAnalysisPngExport } from '@/composables/useAnalysisPngExport'
import { useAnalysisDataExport } from '@/composables/useAnalysisDataExport'
import { useToast } from '@/composables/useToast'
import { exportCanvasAsPng } from '@/infrastructure/pngExport'
import { EXPORT_SUFFIX, DATA_EXPORT_SUFFIX } from '@/domain/exportFileName'
import { buildGamutPointsCsv } from '@/domain/analysisExport'
import {
  useGamutBrush,
  MAX_BRUSH_POINTS,
} from '@/features/gamut-3d/composables/useGamutBrush'

const GamutScene = defineAsyncComponent(() =>
  import('@/features/gamut-3d/GamutScene.vue'),
)

const { selectedImage, images } = useImageStore()
const { toast } = useToast()
const { exportPng, isExporting } = useAnalysisPngExport()
const { exportData, isExporting: isDataExporting } = useAnalysisDataExport()

/** 3Dガマットシーン（PNG エクスポート用の Canvas 取得に使用） */
const gamutSceneRef = ref<{ captureCanvas: () => HTMLCanvasElement | null } | null>(null)

/** 操作パネル（DLボタン・タイトル・各種トグル）の表示状態。GamutScene の 👁 トグルと連動 */
const showChrome = ref(true)

/** 3Dガマットを PNG として保存する */
function downloadGamut3d() {
  exportPng(EXPORT_SUFFIX.gamut3d, (filename) => {
    const canvas = gamutSceneRef.value?.captureCanvas()
    return canvas ? exportCanvasAsPng(canvas, filename) : null
  })
}

/** 3Dガマットの生ポイントクラウドを CSV（AI が3D構造を解析する用）として保存する */
function downloadGamutData() {
  exportData(DATA_EXPORT_SUFFIX.gamut3d, () => {
    const cloud = pointCloudResult.value
    const image = selectedImage.value
    if (!cloud || !image) return null
    const text = buildGamutPointsCsv(
      cloud,
      {
        fileName: image.fileName,
        colorSpace: image.colorAwareImageData.colorSpace,
        width: image.colorAwareImageData.imageData.width,
        height: image.colorAwareImageData.imageData.height,
      },
      new Date().toISOString(),
    )
    return { text, mime: 'text/csv;charset=utf-8', ext: 'csv' }
  })
}

const {
  error: pointCloudError,
  result: pointCloudResult,
  retry: retryPointCloud,
} = useAnalysisResult('gamutPointCloud')

const explanationSections: ExplanationSection[] = [
  {
    label: '3D ガマットとは',
    description: '画像に使われているすべての色を、3D 空間に点として配置した図です。点が広く散らばっていれば多彩な配色、ひとかたまりに集中していれば統一感のある配色だと一目でわかります。マウスドラッグで視点を自由に回転でき、あらゆる角度から色の広がりを観察できます。OKLCH 色空間の座標をそのまま使っているため、空間上で近い点同士は人間の目にも似た色として映り、配色の関係性を直感的に捉えられます。',
    video: '/explanations/3Dgamut-overview.mp4',
  },
  {
    label: '軸の読み方',
    description: '3D 空間の各軸はそれぞれ色の異なる属性に対応しています。縦軸が明度（下が黒、上が白）、中心からの水平距離が彩度（中心が無彩色、外側ほど鮮やか）、回転方向が色相（赤→橙→黄→緑→青→紫と一周）です。たとえば「上のほうに点が集中していれば明るい色が多い画像」「外側に広がっていれば鮮やかな色が多い画像」と読み取れます。OKLCH の座標は知覚的に均一なので、空間上の距離がそのまま「色の違いの大きさ」に対応します。',
    video: '/explanations/3Dgamut-axis.mp4',
  },
  {
    label: 'ブラシ機能',
    description: '画像の気になる部分をブラシでなぞると、その領域の色だけが 3D 空間上でハイライトされます。たとえば空の部分をなぞれば、空に使われている色が 3D 空間のどこに分布しているかが浮かび上がります。「この部分の色は意外と彩度が低い」「背景と主題で明度帯が分かれている」など、部分的な色の特徴を掘り下げて確認できます。',
    video: '/explanations/3Dgamut-brush.mp4',
  },
]

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
</script>
