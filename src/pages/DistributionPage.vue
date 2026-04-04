<template>
  <!-- ページ：色分布（未実装プレースホルダー） -->
  <AnalysisPageLayout
    title="色分布"
    description="L-C-H 統計チャートとパレット抽出"
    :placeholder-icon="BarChart3"
    analysis-title="色分布チャート"
    placeholder-text="画像をアップロードすると色分布の統計チャートやパレット抽出結果が表示されます"
  >
    <!-- 分析本文：将来チャート等を配置（現状はプレースホルダー） -->
    <template #default="{ imageData: _imageData }">
      <Card class="p-8 text-center text-muted-foreground">
        <BarChart3 class="mx-auto h-12 w-12 opacity-30" />
        <p class="mt-3 text-sm">散布図・ヒストグラム・色パレット抽出を実装予定</p>
      </Card>
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { BarChart3 } from 'lucide-vue-next'
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { Card } from '@/components/ui'
</script>
