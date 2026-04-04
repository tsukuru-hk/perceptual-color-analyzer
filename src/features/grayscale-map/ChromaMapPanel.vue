<template>
  <!-- 彩度分析：元画像から chroma グレースケールを生成して表示 -->
  <div v-if="chromaMapData">
    <ImageCanvas :image-data="chromaMapData" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { generateChromaMapUseCase } from '@/application/useCase/generateChromaMapUseCase'
import ImageCanvas from '@/features/image-analysis/ImageCanvas.vue'

const props = defineProps<{
  /** オリジナル画像の ImageData */
  imageData: ImageData
}>()

/** generateChromaMap の結果（失敗時は null で非表示） */
const chromaMapData = ref<ImageData | null>(null)

watch(
  () => props.imageData,
  (newData) => {
    const result = generateChromaMapUseCase(newData)
    chromaMapData.value = result.isSuccess() ? result.value : null
  },
  { immediate: true },
)
</script>
