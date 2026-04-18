<template>
  <!-- ページ：色分布 — カラーパレット抽出とバブルパッキング可視化 -->
  <AnalysisPageLayout
    title="色分布"
    description="画像の使用色をパレットとして抽出し、色グループと比率を可視化"
    :placeholder-icon="BarChart3"
    placeholder-text="画像をアップロードするとカラーパレットが表示されます"
  >
    <template #default="{ colorAwareImageData }">
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
                :disabled="paletteSize <= MIN_PALETTE"
                @click="changePaletteSize(-1, colorAwareImageData)"
              >
                &minus;
              </button>
              <span class="min-w-6 text-center text-sm font-medium tabular-nums">
                {{ paletteSize === 0 ? '自動' : paletteSize }}
              </span>
              <button
                class="flex h-6 w-6 items-center justify-center rounded border border-border text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                :disabled="paletteSize >= MAX_PALETTE"
                @click="changePaletteSize(+1, colorAwareImageData)"
              >
                +
              </button>
            </div>
          </div>
          <AnalysisErrorCard
            v-if="isAnalysisError(latestResult(colorAwareImageData))"
            :message="(latestResult(colorAwareImageData) as any).message"
            @retry="retryAnalysis(selectedImage!.id, 'colorClustering')"
          />
          <template v-else-if="displayedResult(colorAwareImageData)">
            <ClusterBubbleChart
              :data="displayedResult(colorAwareImageData)!"
              :height="480"
              @cluster-select="onClusterSelect"
            />
            <div class="mt-3">
              <ClusterRatioBar :clusters="displayedResult(colorAwareImageData)!.clusters" />
            </div>
          </template>
          <AnalysisSpinner v-else />
        </div>
      </div>
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { BarChart3 } from 'lucide-vue-next'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import type { ColorClusterResult } from '@/domain/colorCluster'
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { InfoTooltip, AnalysisSpinner, AnalysisErrorCard } from '@/components/ui'
import { ClusterBubbleChart, ClusterRatioBar } from '@/features/color-cluster'
import { isAnalysisError } from '@/types/analysis'
import { useImageStore } from '@/composables/useImageStore'

/** 0 = 自動, 2 が手動指定の最小値 */
const MIN_PALETTE = 0
const MAX_PALETTE = 60

const { selectedImage, getAnalysis, retryAnalysis, invalidateAnalysis } = useImageStore()

/** 0 = 自動決定 */
const paletteSize = ref(0)

/** 前回の正常結果を保持 — 再計算中もこれを表示し続ける */
const prevResult = shallowRef<ColorClusterResult | null>(null)

function latestResult(source: ColorAwareImageData): ColorClusterResult | null {
  const result = selectedImage.value
    ? getAnalysis(selectedImage.value.id, source, 'colorClustering', { paletteSize: paletteSize.value })
    : null
  if (result && !isAnalysisError(result)) {
    prevResult.value = result as ColorClusterResult
  }
  return result
}

function displayedResult(source: ColorAwareImageData): ColorClusterResult | null {
  const fresh = latestResult(source)
  if (fresh && !isAnalysisError(fresh)) return fresh as ColorClusterResult
  return prevResult.value
}

function changePaletteSize(delta: number, source: ColorAwareImageData) {
  let next = paletteSize.value + delta
  // 自動(0) から - は何もしない、自動(0) から + は 2 に飛ぶ
  if (next < MIN_PALETTE) return
  if (paletteSize.value === 0 && delta > 0) next = 2
  // 1 から - は自動(0) に戻る
  if (next === 1) next = 0
  if (next > MAX_PALETTE) return

  paletteSize.value = next
  if (selectedImage.value) {
    invalidateAnalysis(selectedImage.value.id, 'colorClustering')
  }
}

function onClusterSelect(clusterId: number) {
  console.log('Cluster selected:', clusterId)
}
</script>
