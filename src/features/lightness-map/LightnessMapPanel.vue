<template>
  <!-- 明度分析：元画像から lightness グレースケールを生成して表示 -->
  <div v-if="lightnessMapData">
    <ImageCanvas :image-data="lightnessMapData" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { generateLightnessMapUseCase } from '@/application/useCase/generateLightnessMapUseCase'
import ImageCanvas from '@/features/image-analysis/ImageCanvas.vue'

const props = defineProps<{
  /** オリジナル画像の ImageData */
  imageData: ImageData
}>()

/** generateLightnessMap の結果（失敗時は null で非表示） */
const lightnessMapData = ref<ImageData | null>(null)

watch(
  () => props.imageData,
  (newData) => {
    const result = generateLightnessMapUseCase(newData)
    lightnessMapData.value = result.isSuccess() ? result.value : null
  },
  { immediate: true },
)
</script>
