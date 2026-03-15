<template>
  <div>
    <h1 class="text-2xl font-bold text-foreground">Perceptual Color Analyzer</h1>
    <p class="mt-1 text-sm text-muted-foreground">OKLCH で画像の彩度・明度を解析</p>
    <div class="mt-6">
      <ImageAnalysisContainer />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ImageAnalysisContainer } from '@/features/image-analysis'
</script>
