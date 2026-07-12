<template>
  <!-- ページ：色分布 — カラーパレット抽出とバブルパッキング可視化 -->
  <AnalysisPageLayout
    title="色分布"
    description="使われている色をパレットに抽出し、それぞれの色がどのくらいの面積を占めているかを可視化します。"
    placeholder-text="画像をアップロードすると色分布が表示されます"
  >
    <template #title-icon>
      <img src="@/assets/Distribution-icon.png" alt="" class="h-14 w-14" />
    </template>
    <template #explanation="{ close }">
      <ExplanationContent
        title="色分布"
        :sections="explanationSections"
        @close="close"
      >
        <template #icon>
          <img src="@/assets/Distribution-icon.png" alt="" class="h-8 w-8" />
        </template>
      </ExplanationContent>
    </template>
    <template #default>
      <div class="space-y-4">
        <div>
          <div class="mb-2 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <SectionLabel>
                カラーパレット
                <InfoTooltip content="OKLCH 知覚色空間で色相・明度・彩度をグリッド分割し、画像に使われている色を自動的にパレットとして抽出しています。" />
              </SectionLabel>
              <DownloadButton
                v-if="displayedResult"
                :disabled="isExporting"
                @click="downloadColorBubble"
              />
              <DataDownloadButton
                v-if="displayedResult"
                label="JSON"
                title="パレットデータを JSON でダウンロード（AI 分析用）"
                :disabled="isDataExporting"
                @click="downloadDistributionData"
              />
            </div>
            <!-- パレット色数ステッパー -->
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-muted-foreground">パレット数</span>
              <button
                class="flex h-6 w-6 items-center justify-center rounded border border-border text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                :disabled="!canDecrement"
                @click="changePaletteSize(-1)"
              >
                &minus;
              </button>
              <span class="min-w-6 text-center text-sm font-medium tabular-nums">
                <template v-if="currentPaletteSize === 0">
                  自動<template v-if="autoPaletteCount > 0">({{ autoPaletteCount }})</template>
                </template>
                <template v-else>{{ currentPaletteSize }}</template>
              </span>
              <button
                class="flex h-6 w-6 items-center justify-center rounded border border-border text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                :disabled="!canIncrement"
                @click="changePaletteSize(+1)"
              >
                +
              </button>
            </div>
          </div>
          <AnalysisErrorCard
            v-if="currentError"
            :message="currentError.message"
            @retry="retryClustering"
          />
          <template v-else-if="displayedResult">
            <ClusterBubbleChart
              ref="bubbleChartRef"
              :key="imageId"
              :data="displayedResult"
              :height="480"
            />
            <div class="mt-3">
              <ClusterRatioBar :clusters="displayedResult.clusters" />
            </div>
          </template>
          <AnalysisSpinner v-else class="aspect-square" />
        </div>
      </div>
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, reactive, ref, shallowRef, watch } from 'vue'
import type { ColorClusterResult } from '@/domain/colorCluster'
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { InfoTooltip, AnalysisSpinner, AnalysisErrorCard, ExplanationContent, SectionLabel, DownloadButton, DataDownloadButton } from '@/components/ui'
import type { ExplanationSection } from '@/components/ui'
import { ClusterRatioBar } from '@/features/color-cluster'
import { isAnalysisError } from '@/types/analysis'
import { useImageStore } from '@/composables/useImageStore'
import { useAnalysisPngExport } from '@/composables/useAnalysisPngExport'
import { useAnalysisDataExport } from '@/composables/useAnalysisDataExport'
import { exportSvgAsPng } from '@/infrastructure/pngExport'
import { EXPORT_SUFFIX, DATA_EXPORT_SUFFIX } from '@/domain/exportFileName'
import { buildDistributionExport } from '@/domain/analysisExport'

const ClusterBubbleChart = defineAsyncComponent(() =>
  import('@/features/color-cluster/ClusterBubbleChart.vue'),
)

/** 手動パレット指定時の最小値（これ未満にしようとすると自動モードへ戻る） */
const MIN_MANUAL_PALETTE = 2
/** 手動パレット指定時の最大値 */
const MAX_PALETTE = 60

const { images, selectedImage, getAnalysis, retryAnalysis } = useImageStore()
const { exportPng, isExporting } = useAnalysisPngExport()
const { exportData, isExporting: isDataExporting } = useAnalysisDataExport()

/** カラーバブルチャート（PNG エクスポート用の SVG 取得に使用） */
const bubbleChartRef = ref<{ getSvgElement: () => SVGSVGElement | null } | null>(null)

/** カラーバブルを PNG として保存する */
function downloadColorBubble() {
  exportPng(EXPORT_SUFFIX.colorBubble, (filename) => {
    const svg = bubbleChartRef.value?.getSvgElement()
    return svg ? exportSvgAsPng(svg, filename) : null
  })
}

/** 色分布（パレット）データを JSON（AI 分析用）として保存する */
function downloadDistributionData() {
  exportData(DATA_EXPORT_SUFFIX.colorDistribution, () => {
    const result = displayedResult.value
    const image = selectedImage.value
    if (!result || !image) return null
    const data = buildDistributionExport(
      result,
      {
        fileName: image.fileName,
        colorSpace: image.colorAwareImageData.colorSpace,
        width: image.colorAwareImageData.imageData.width,
        height: image.colorAwareImageData.imageData.height,
      },
      new Date().toISOString(),
    )
    return { text: JSON.stringify(data, null, 2), mime: 'application/json', ext: 'json' }
  })
}

function retryClustering() {
  const id = imageId.value
  if (!id) return
  retryAnalysis(id, 'colorClustering', { paletteSize: currentPaletteSize.value })
}

const explanationSections: ExplanationSection[] = [
  {
    label: '色分布とは',
    description: '画像に使われている色を自動でグループ分けし、代表色としてパレットを抽出する機能です。どんな色が画像の主役で、どんな色が脇役かが一目でわかります。各色が画像全体のどのくらいの面積を占めているかも数値と図で確認でき、配色バランスの把握に役立ちます。OKLCH 色空間で色をグループ分けしているため、人間の目に似て見える色同士が自然にまとまり、感覚に合ったパレットが得られます。',
    image: '/explanations/distribution-overview.png',
  },
  {
    label: 'カラーパレットとは',
    description: '画像内の似た色をまとめて、代表的な色の一覧として抽出したものです。面積の大きい色がメインカラー、小さい色がアクセントカラーに相当します。パレット数は ＋/− ボタンで調整でき、大まかな配色傾向を見たいときは少なく、細かい色の違いまで見たいときは多くすると効果的です。OKLCH の知覚均一性のおかげで、似た色が適切にまとまるため、直感に反するグルーピングが起きにくくなっています。',
    image: '/explanations/distribution-pallete.png',
  },
  {
    label: 'バブルチャートとは',
    description: '抽出された各色を円（バブル）で表示し、円の大きさで面積比を表現した図です。大きな円ほど画像内で広い面積を占めている色、小さな円ほどアクセント的に使われている色です。色同士の量的なバランスを視覚的に比較でき、「この色が支配的」「2色がほぼ同量」といった配色の構造が直感的にわかります。',
    image: '/explanations/distribution-bubble.png',
  },
]

/** 選択中の画像ID（未選択時は空文字列） */
const imageId = computed(() => selectedImage.value?.id ?? '')

/** 画像ごとのパレットサイズ設定（0 = 自動） */
const paletteSizeByImage = reactive(new Map<string, number>())

/** 画像ごとの「自動モードで得られた k」を記憶（UI のボタン閾値・表示に利用） */
const autoPaletteCountByImage = reactive(new Map<string, number>())

/** 現在選択中の画像のパレットサイズ */
const currentPaletteSize = computed(() => {
  const id = imageId.value
  if (!id) return 0
  return paletteSizeByImage.get(id) ?? 0
})

/** 自動モード時のパレット数（初回自動計算時に記憶した値） */
const autoPaletteCount = computed(() => {
  const id = imageId.value
  if (!id) return 0
  return autoPaletteCountByImage.get(id) ?? 0
})

/**
 * 現在の画像・パレット設定での分析結果を一元取得する computed。
 * getAnalysis はキャッシュが無いときだけ Worker へ dispatch する冪等関数。
 */
const currentResult = computed(() => {
  const id = imageId.value
  const source = selectedImage.value?.colorAwareImageData
  if (!id || !source) return null
  return getAnalysis(id, source, 'colorClustering', { paletteSize: currentPaletteSize.value })
})

const currentError = computed(() =>
  isAnalysisError(currentResult.value) ? currentResult.value : null,
)

const freshResult = computed<ColorClusterResult | null>(() => {
  const r = currentResult.value
  return r != null && !isAnalysisError(r) ? r : null
})

/** 前回の正常結果を保持 — 再計算中もこれを表示し続ける */
const prevResult = shallowRef<ColorClusterResult | null>(null)
let prevResultImageId = ''

/** 表示対象：最新結果があればそれ、無ければ前回の正常結果 */
const displayedResult = computed<ColorClusterResult | null>(
  () => freshResult.value ?? prevResult.value,
)

// ─── 副作用は watch に一元化 ───

/** 画像が切り替わったら前回結果をリセット */
watch(imageId, (id) => {
  if (id !== prevResultImageId) {
    prevResult.value = null
    prevResultImageId = id
  }
})

/** 正常結果が得られたら prevResult と「自動モードの k」を更新 */
watch(
  freshResult,
  (result) => {
    if (!result) return
    prevResult.value = result
    if (currentPaletteSize.value === 0) {
      const id = imageId.value
      if (id && autoPaletteCountByImage.get(id) !== result.k) {
        autoPaletteCountByImage.set(id, result.k)
      }
    }
  },
  { immediate: true },
)

/** 画像が削除されたら、それに紐づくローカル状態を解放 */
watch(
  images,
  (list) => {
    const alive = new Set(list.map((i) => i.id))
    for (const key of [...paletteSizeByImage.keys()]) {
      if (!alive.has(key)) paletteSizeByImage.delete(key)
    }
    for (const key of [...autoPaletteCountByImage.keys()]) {
      if (!alive.has(key)) autoPaletteCountByImage.delete(key)
    }
  },
  { deep: true },
)

// ─── ステッパーの有効化条件 ───

const canDecrement = computed(() => {
  if (!imageId.value) return false
  const current = currentPaletteSize.value
  if (current === 0) {
    // 自動モード: 実パレット数が閾値を超えているときだけ減らせる
    return autoPaletteCount.value > MIN_MANUAL_PALETTE
  }
  return current > MIN_MANUAL_PALETTE
})

const canIncrement = computed(() => {
  if (!imageId.value) return false
  const current = currentPaletteSize.value
  // 自動モード: 自動で決まる値が上限なので増やせない
  if (current === 0) return false
  return current < MAX_PALETTE
})

function changePaletteSize(delta: number) {
  const id = imageId.value
  if (!id) return

  const current = currentPaletteSize.value
  const auto = autoPaletteCount.value

  let next: number
  if (current === 0) {
    // 自動モード: 実際のパレット数を基準に減らす（増やすは disabled）
    if (auto <= 0 || delta > 0) return
    next = auto + delta
    if (next < MIN_MANUAL_PALETTE) next = 0
  } else {
    next = current + delta
    if (next < MIN_MANUAL_PALETTE) next = 0
    // 自動パレット数以上に増やしたら自動に戻す
    if (auto > 0 && next >= auto) next = 0
  }

  if (next > MAX_PALETTE) next = MAX_PALETTE

  // スロットキーが paletteSize 別に分かれているため、
  // サイズ変更は新スロットのキャッシュミス経由で自然に再計算される（invalidate 不要）
  paletteSizeByImage.set(id, next)
}
</script>
