<template>
  <div class="canvas-wrap">
    <canvas
      ref="canvasRef"
      class="preview"
      @click="handleClick"
    />
    <p class="hint">クリックでピクセルの OKLCH を表示</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  imageData: ImageData
  onCanvasClick: (x: number, y: number) => void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

watch(
  () => props.imageData,
  async (data) => {
    await nextTick()
    drawCanvas(data)
  },
  { immediate: true },
)

function drawCanvas(data: ImageData) {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width = data.width
  canvas.height = data.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.putImageData(data, 0, 0)
}

function handleClick(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const x = Math.floor((e.clientX - rect.left) * scaleX)
  const y = Math.floor((e.clientY - rect.top) * scaleY)

  props.onCanvasClick(x, y)
}
</script>

<style scoped>
.canvas-wrap {
  margin: 1rem 0;
}
.preview {
  display: block;
  max-width: 100%;
  height: auto;
  border: 1px solid #ddd;
  cursor: crosshair;
}
.hint {
  font-size: 0.875rem;
  color: #666;
  margin-top: 0.5rem;
}
</style>
