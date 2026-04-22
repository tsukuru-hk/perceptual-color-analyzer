<template>
  <div
    ref="overlayRef"
    class="absolute inset-0"
    :class="brushMode ? 'cursor-crosshair' : 'pointer-events-none'"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
    @pointercancel="onPointerUp"
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
import { ref, computed, onBeforeUnmount } from 'vue'
import { oklchToPosition, DEFAULT_GAMUT_SCALE } from '@/domain/oklchTo3d'
import { createPixelConverter } from '@/infrastructure/colorSpaceConverter'
import type { ColorSpace } from '@/domain/colorSpace'

const BRUSH_RADIUS = 3
const THROTTLE_MS = 16

const props = defineProps<{
  imageData: ImageData
  colorSpace: ColorSpace
  brushMode: boolean
}>()

const emit = defineEmits<{
  /** ストローク開始（画像切替を一時停止させる用途） */
  strokeStart: []
  /** ストローク終了 */
  strokeEnd: []
  /** 1 点サンプリング通知 */
  brushStroke: [positions: Float32Array, colors: Float32Array, count: number]
}>()

const overlayRef = ref<HTMLDivElement | null>(null)
const isDragging = ref(false)
const cursorX = ref(0)
const cursorY = ref(0)
const cursorVisible = ref(false)

/** 色空間ごとの pixel → OKLCH 変換関数。色空間変更時のみ再生成 */
const toOklch = computed(() => createPixelConverter(props.colorSpace))

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
  const ratioX = props.imageData.width / rect.width
  const ratioY = props.imageData.height / rect.height
  const ix = Math.floor((e.clientX - rect.left) * ratioX)
  const iy = Math.floor((e.clientY - rect.top) * ratioY)
  if (ix < 0 || iy < 0 || ix >= props.imageData.width || iy >= props.imageData.height) return null
  return { ix, iy }
}

// 1 点分の出力バッファ（毎回新規確保しない）
const posOut = new Float32Array(3)
const colorOut = new Float32Array(3)

/** ブラシ位置のピクセル 1 点をサンプリングして OKLCH → 3D 変換し emit */
function sampleBrush(e: PointerEvent): void {
  const coords = toImageCoords(e)
  if (!coords) return

  const { imageData } = props
  const { width, data } = imageData

  const offset = (coords.iy * width + coords.ix) * 4
  const a = data[offset + 3]!
  if (a < 128) return

  const r = data[offset]!
  const g = data[offset + 1]!
  const b = data[offset + 2]!

  const oklch = toOklch.value(r, g, b)
  if (!oklch) return

  const p = oklchToPosition(oklch.l, oklch.c, oklch.h, DEFAULT_GAMUT_SCALE)
  posOut[0] = p.x; posOut[1] = p.y; posOut[2] = p.z
  colorOut[0] = r / 255; colorOut[1] = g / 255; colorOut[2] = b / 255

  emit('brushStroke', posOut, colorOut, 1)
}

let lastSampleTime = 0

function onPointerDown(e: PointerEvent): void {
  if (!props.brushMode) return
  isDragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  lastSampleTime = 0
  emit('strokeStart')
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
  if (!isDragging.value) return
  isDragging.value = false
  emit('strokeEnd')
}

// アンマウント時にストローク保留を必ず解除（画像切替の保留状態が残らないよう）
onBeforeUnmount(() => {
  if (isDragging.value) {
    isDragging.value = false
    emit('strokeEnd')
  }
})
</script>
