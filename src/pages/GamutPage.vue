<template>
  <!-- ページ：3D ガマット（未実装プレースホルダー） -->
  <AnalysisPageLayout
    title="3D ガマット"
    description="OKLCH 色空間での 3D ポイントクラウド可視化"
    :placeholder-icon="Box"
    analysis-title="3D ガマット"
    placeholder-text="画像をアップロードするとOKLCH色空間上の3Dガマットマップが表示されます"
  >
    <!-- 分析本文：将来 Three.js 可視化を配置 -->
    <template #default="{ imageData: _imageData }">
      <Card class="p-8 text-center text-muted-foreground">
        <Box class="mx-auto h-12 w-12 opacity-30" />
        <p class="mt-3 text-sm">TresJS/Three.js による 3D ガマット可視化を実装予定</p>
      </Card>
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { Box } from 'lucide-vue-next'
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { Card } from '@/components/ui'
</script>
