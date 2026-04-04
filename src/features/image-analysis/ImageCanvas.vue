<template>
  <div class="canvas-wrap">
    <canvas ref="canvasRef" class="preview" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  /** 表示するピクセルバッファ */
  imageData: ImageData
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

/** @param data 描画する ImageData */
function drawCanvas(data: ImageData) {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width = data.width
  canvas.height = data.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.putImageData(data, 0, 0)
}
</script>

<style scoped>
.canvas-wrap {
  margin: 1rem 0 0;
}
.preview {
  display: block;
  max-width: 100%;
  height: auto;
  border: 1px solid #ddd;
}
</style>
