<template>
  <!-- ページ：色分布 — カラークラスタリングとバブルパッキング可視化 -->
  <AnalysisPageLayout
    title="色分布"
    description="画像の使用色をクラスタリングし、支配的な色グループを可視化"
    :placeholder-icon="BarChart3"
    placeholder-text="画像をアップロードすると色のクラスタリング結果が表示されます"
  >
    <template #default="{ colorAwareImageData }">
      <div class="space-y-4">
        <div>
          <div class="mb-2 flex items-center justify-between">
            <h3 class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              カラークラスタ
              <InfoTooltip content="OKLCH 知覚色空間で K-means クラスタリングを行い、類似色をグループ化しています。" />
            </h3>
            <!-- クラスタ数ステッパー -->
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-muted-foreground">クラスタ数</span>
              <button
                class="flex h-6 w-6 items-center justify-center rounded border border-border text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                :disabled="clusterK <= MIN_K"
                @click="changeK(-1, colorAwareImageData)"
              >
                &minus;
              </button>
              <span class="w-6 text-center text-sm font-medium tabular-nums">{{ clusterK }}</span>
              <button
                class="flex h-6 w-6 items-center justify-center rounded border border-border text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                :disabled="clusterK >= MAX_K"
                @click="changeK(+1, colorAwareImageData)"
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
              <ClusterLegend :clusters="displayedResult(colorAwareImageData)!.clusters" />
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
import { ClusterBubbleChart, ClusterLegend } from '@/features/color-cluster'
import { isAnalysisError } from '@/types/analysis'
import { useImageStore } from '@/composables/useImageStore'

const MIN_K = 3
const MAX_K = 100

const { selectedImage, getAnalysis, retryAnalysis, invalidateAnalysis } = useImageStore()

const clusterK = ref(12)

/** 前回の正常結果を保持 — 再計算中もこれを表示し続ける */
const prevResult = shallowRef<ColorClusterResult | null>(null)

/**
 * キャッシュから最新結果を取得（null = 計算中、エラー = 失敗）。
 * 副作用として prevResult を更新する。
 */
function latestResult(source: ColorAwareImageData): ColorClusterResult | null {
  const result = selectedImage.value
    ? getAnalysis(selectedImage.value.id, source, 'colorClustering', { clusterK: clusterK.value })
    : null
  if (result && !isAnalysisError(result)) {
    prevResult.value = result as ColorClusterResult
  }
  return result
}

/**
 * 表示用: 新しい結果があればそれを、なければ前回結果を返す。
 * 再計算中にスピナーが出ず、旧データが表示され続ける。
 */
function displayedResult(source: ColorAwareImageData): ColorClusterResult | null {
  const fresh = latestResult(source)
  if (fresh && !isAnalysisError(fresh)) return fresh as ColorClusterResult
  return prevResult.value
}

function changeK(delta: number, source: ColorAwareImageData) {
  const next = clusterK.value + delta
  if (next < MIN_K || next > MAX_K) return
  clusterK.value = next
  if (selectedImage.value) {
    invalidateAnalysis(selectedImage.value.id, 'colorClustering')
  }
}

function onClusterSelect(clusterId: number) {
  console.log('Cluster selected:', clusterId)
}
</script>
