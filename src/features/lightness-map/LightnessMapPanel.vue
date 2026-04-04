<template>
  <!-- 明度分析：元画像から lightness グレースケールを生成して表示 -->
  <div v-if="lightnessMapData">
    <ImageCanvas :image-data="lightnessMapData" />
  </div>
</template>

<script setup lang="ts">
import ImageCanvas from '@/features/image-analysis/ImageCanvas.vue'

defineProps<{
  /** キャッシュ済みの明度マップ ImageData */
  lightnessMapData: ImageData | null
}>()
</script>
