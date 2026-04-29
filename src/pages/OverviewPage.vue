<template>
  <AnalysisPageLayout
    title="Perceptual Color Analyzer"
    description="OKLCH で画像の彩度・明度・色相を総合解析"
    placeholder-text="画像をアップロードすると総合分析が表示されます"
    full-width
  >
    <template #default="{ colorAwareImageData }">
      <div ref="lottieContainer" style="width: 300px; height: 300px; margin: 0 auto 24px" />
      <OverviewGrid :color-aware-image-data="colorAwareImageData" />
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import lottie from 'lottie-web'
import type { AnimationItem } from 'lottie-web'
import animationData from '@/assets/animations/data.json'
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { OverviewGrid } from '@/features/overview'

const lottieContainer = ref<HTMLDivElement>()
let anim: AnimationItem | null = null

onMounted(() => {
  if (lottieContainer.value) {
    anim = lottie.loadAnimation({
      container: lottieContainer.value,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData,
    })
  }
})

onUnmounted(() => {
  anim?.destroy()
})
</script>
