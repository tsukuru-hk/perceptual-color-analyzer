<template>
  <div
    ref="overlayRef"
    class="absolute inset-0"
    :class="brushMode ? 'cursor-crosshair' : 'pointer-events-none'"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
  >
    <!-- ブラシカーソル -->
    <div
      v-if="brushMode && cursorVisible"
      class="pointer-events-none absolute rounded-full border-2 border-white/80 bg-white/20"
      :style="cursorStyle"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 画像キャンバス上に重ねるブラシオーバーレイ。
 * ドラッグ操作でピクセルを収集し、OKLCH → 3D 座標に変換して親に emit する。
 */
import { ref, computed } from 'vue'
import { oklchToPosition, DEFAULT_GAMUT_SCALE } from '@/domain/oklchTo3d'
import { createPixelConverter } from '@/infrastructure/colorSpaceConverter'
import type { ColorSpace } from '@/domain/colorSpace'

const BRUSH_RADIUS = 3

const props = defineProps<{
  imageData: ImageData
  colorSpace: ColorSpace
  brushMode: boolean
}>()

const emit = defineEmits<{
  brushStroke: [positions: Float32Array, colors: Float32Array, count: number]
}>()

const overlayRef = ref<HTMLDivElement | null>(null)
const isDragging = ref(false)
const cursorX = ref(0)
const cursorY = ref(0)
const cursorVisible = ref(false)

const cursorStyle = computed(() => {
  const size = BRUSH_RADIUS * 2
  return {
    width: `${size}px`,
    height: `${size}px`,
    left: `${cursorX.value - BRUSH_RADIUS}px`,
    top: `${cursorY.value - BRUSH_RADIUS}px`,
  }
})

/** オーバーレイ上のポインタ座標 → 画像ピクセル座標 */
function toImageCoords(e: PointerEvent): { ix: number; iy: number } | null {
  const el = overlayRef.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  // CSS 表示サイズに対する比率で画像座標に変換
  const ratioX = props.imageData.width / rect.width
  const ratioY = props.imageData.height / rect.height
  const ix = Math.floor((e.clientX - rect.left) * ratioX)
  const iy = Math.floor((e.clientY - rect.top) * ratioY)
  if (ix < 0 || iy < 0 || ix >= props.imageData.width || iy >= props.imageData.height) return null
  return { ix, iy }
}

/** ブラシ位置のピクセル1点をサンプリングして OKLCH → 3D 変換し emit */
function sampleBrush(e: PointerEvent): void {
  const coords = toImageCoords(e)
  if (!coords) return

  const { imageData, colorSpace } = props
  const { width, data } = imageData
  const toOklch = createPixelConverter(colorSpace)

  const offset = (coords.iy * width + coords.ix) * 4
  const a = data[offset + 3]!
  if (a < 128) return

  const r = data[offset]!
  const g = data[offset + 1]!
  const b = data[offset + 2]!

  const oklch = toOklch(r, g, b)
  if (!oklch) return

  const pos = oklchToPosition(oklch.l, oklch.c, oklch.h, DEFAULT_GAMUT_SCALE)
  const positions = new Float32Array([pos.x, pos.y, pos.z])
  const colors = new Float32Array([r / 255, g / 255, b / 255])

  emit('brushStroke', positions, colors, 1)
}

let lastSampleTime = 0
const THROTTLE_MS = 100

function onPointerDown(e: PointerEvent): void {
  if (!props.brushMode) return
  isDragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  lastSampleTime = 0
  sampleBrush(e)
}

function onPointerMove(e: PointerEvent): void {
  if (!props.brushMode) return

  const el = overlayRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  cursorX.value = e.clientX - rect.left
  cursorY.value = e.clientY - rect.top
  cursorVisible.value = true

  if (!isDragging.value) return

  const now = performance.now()
  if (now - lastSampleTime < THROTTLE_MS) return
  lastSampleTime = now
  sampleBrush(e)
}

function onPointerUp(): void {
  isDragging.value = false
}
</script>
