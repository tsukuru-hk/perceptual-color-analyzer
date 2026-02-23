<template>
  <div>
    <div class="upload">
      <input
        type="file"
        accept="image/*"
        @change="onFileChange"
      />
    </div>

    <p v-if="loadProgress === 'loading'" class="status">読み込み中...</p>
    <p v-if="loadProgress === 'error' && errorMessage" class="error">
      {{ errorMessage }}
    </p>

    <ImageCanvas
      v-if="imageDataRef"
      :image-data="imageDataRef"
      :on-canvas-click="onCanvasClick"
    />

    <PixelOklchResult :oklch-value="pixelOklch" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { OklchValue } from '@/domain/oklch'
import { loadImageUseCase } from '@/application/useCase/loadImageUseCase'
import { getPixelOklchUseCase } from '@/application/useCase/getPixelOklchUseCase'
import ImageCanvas from './ImageCanvas.vue'
import PixelOklchResult from './PixelOklchResult.vue'

const imageDataRef = ref<ImageData | null>(null)
const errorMessage = ref<string | null>(null)
const pixelOklch = ref<OklchValue | null>(null)
const loadProgress = ref<'idle' | 'loading' | 'done' | 'error'>('idle')

const maxWidth = 800
const maxHeight = 600

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  errorMessage.value = null
  pixelOklch.value = null
  loadProgress.value = 'loading'

  const result = await loadImageUseCase(file, { maxWidth, maxHeight })

  if (result.isFailure()) {
    errorMessage.value = result.error.message
    loadProgress.value = 'error'
    imageDataRef.value = null
    return
  }

  imageDataRef.value = result.value
  loadProgress.value = 'done'
}

function onCanvasClick(x: number, y: number) {
  const data = imageDataRef.value
  if (!data) return

  const result = getPixelOklchUseCase(data, x, y)
  if (result.isFailure()) {
    errorMessage.value = result.error.message
    pixelOklch.value = null
    return
  }
  errorMessage.value = null
  pixelOklch.value = result.value
}
</script>

<style scoped>
.upload {
  margin-bottom: 1rem;
}
.upload input {
  font-size: 1rem;
}
.status {
  color: #666;
}
.error {
  color: #c00;
  margin: 0.5rem 0;
}
</style>
