<template>
  <div class="app">
    <h1>Perceptual Color Analyzer</h1>
    <p class="subtitle">OKLCH で画像の彩度・明度を解析</p>

    <ImageAnalysisContainer />
  </div>
</template>

<script setup lang="ts">
import { ImageAnalysisContainer } from '@/features/image-analysis'
</script>

<style scoped>
.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, sans-serif;
}
h1 {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}
.subtitle {
  color: #666;
  margin-bottom: 1.5rem;
}
</style>
