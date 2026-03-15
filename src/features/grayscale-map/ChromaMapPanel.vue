<template>
  <div v-if="chromaMapData">
    <ImageCanvas :image-data="chromaMapData" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { generateChromaMapUseCase } from '@/application/useCase/generateChromaMapUseCase'
import ImageCanvas from '@/features/image-analysis/ImageCanvas.vue'

const props = defineProps<{
  imageData: ImageData
}>()

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
