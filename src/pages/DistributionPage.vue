<template>
  <!-- ページ：色分布 — カラーパレット抽出とバブルパッキング可視化 -->
  <AnalysisPageLayout
    title="色分布"
    description="画像の使用色をパレットとして抽出し、色グループと比率を可視化"
    :placeholder-icon="BarChart3"
    placeholder-text="画像をアップロードするとカラーパレットが表示されます"
  >
    <template #default>
      <div class="space-y-4">
        <div>
          <div class="mb-2 flex items-center justify-between">
            <h3 class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              カラーパレット
              <InfoTooltip content="OKLCH 知覚色空間で色相・明度・彩度をグリッド分割し、画像に使われている色を自動的にパレットとして抽出しています。" />
            </h3>
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
            @retry="retryAnalysis(imageId, 'colorClustering')"
          />
          <template v-else-if="displayedResult">
            <ClusterBubbleChart
              :key="imageId"
              :data="displayedResult"
              :height="480"
            />
            <div class="mt-3">
              <ClusterRatioBar :clusters="displayedResult.clusters" />
            </div>
          </template>
          <AnalysisSpinner v-else />
        </div>
      </div>
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, reactive, shallowRef, watch } from 'vue'
import { BarChart3 } from 'lucide-vue-next'
import type { ColorClusterResult } from '@/domain/colorCluster'
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { InfoTooltip, AnalysisSpinner, AnalysisErrorCard } from '@/components/ui'
import { ClusterRatioBar } from '@/features/color-cluster'
import { isAnalysisError } from '@/types/analysis'
import { useImageStore } from '@/composables/useImageStore'

const ClusterBubbleChart = defineAsyncComponent(() =>
  import('@/features/color-cluster/ClusterBubbleChart.vue'),
)

/** 手動パレット指定時の最小値（これ未満にしようとすると自動モードへ戻る） */
const MIN_MANUAL_PALETTE = 2
/** 手動パレット指定時の最大値 */
const MAX_PALETTE = 60

const { images, selectedImage, getAnalysis, retryAnalysis, invalidateAnalysis } = useImageStore()

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

  paletteSizeByImage.set(id, next)
  invalidateAnalysis(id, 'colorClustering')
}
</script>
