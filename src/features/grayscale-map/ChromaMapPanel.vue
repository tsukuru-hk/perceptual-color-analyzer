<template>
  <!-- 彩度分析：元画像から chroma グレースケールを生成して表示 -->
  <div v-if="chromaMapData">
    <ImageCanvas :image-data="chromaMapData" />
  </div>
</template>

<script setup lang="ts">
import ImageCanvas from '@/features/image-analysis/ImageCanvas.vue'

defineProps<{
  /** キャッシュ済みの彩度マップ ImageData */
  chromaMapData: ImageData | null
}>()
</script>
