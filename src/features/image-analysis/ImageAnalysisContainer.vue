<template>
  <ImageCanvas :image-data="imageData" />
</template>

<script setup lang="ts">
import ImageCanvas from './ImageCanvas.vue'

defineProps<{
  /** 分析対象のラスタ（AnalysisPageLayout から渡される） */
  imageData: ImageData
}>()
</script>
