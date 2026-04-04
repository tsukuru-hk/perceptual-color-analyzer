<template>
  <!-- ページ：色相（未実装プレースホルダー） -->
  <AnalysisPageLayout
    title="色相分析"
    description="OKLCH Hue チャンネルの詳細分析"
    :placeholder-icon="Rainbow"
    analysis-title="色相マップ"
    placeholder-text="画像をアップロードすると色相の分布や支配的な色相クラスタが表示されます"
  >
    <!-- 分析本文：将来色相マップ等を配置 -->
    <template #default="{ colorAwareImageData: _colorAwareImageData }">
      <Card class="p-8 text-center text-muted-foreground">
        <Rainbow class="mx-auto h-12 w-12 opacity-30" />
        <p class="mt-3 text-sm">色相ホイール・色相マップ・支配的色相クラスタを実装予定</p>
      </Card>
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { Rainbow } from 'lucide-vue-next'
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { Card } from '@/components/ui'
</script>
