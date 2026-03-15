<template>
  <AnalysisPageLayout
    title="Perceptual Color Analyzer"
    description="OKLCH で画像の彩度・明度・色相を総合解析"
  >
    <ImageAnalysisContainer />
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { ImageAnalysisContainer } from '@/features/image-analysis'
</script>
