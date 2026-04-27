<template>
  <AnalysisPageLayout
    title="Perceptual Color Analyzer"
    description="OKLCH で画像の彩度・明度・色相を総合解析"
    placeholder-text="画像をアップロードすると総合分析が表示されます"
    full-width
  >
    <template #default="{ colorAwareImageData }">
      <OverviewGrid :color-aware-image-data="colorAwareImageData" />
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { OverviewGrid } from '@/features/overview'
</script>
