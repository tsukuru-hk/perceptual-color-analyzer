<template>
  <canvas
    v-if="activeBand !== 'all'"
    ref="canvasRef"
    class="block rounded border border-white/20"
    style="max-width: 210px; height: auto;"
  />
</template>

<script setup lang="ts">
import { ref, watch, nextTick, shallowRef } from 'vue'
import type { ColorAwareImageData } from '@/domain/colorSpace'
import { createPixelConverter } from '@/infrastructure/colorSpaceConverter'

const props = defineProps<{
  source: ColorAwareImageData
  activeBand: 'all' | 'dark' | 'mid' | 'light'
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

// バンドマスクキャッシュ: 各ピクセルのバンドインデックス (0=dark, 1=mid, 2=light, 255=transparent)
const bandMask = shallowRef<Uint8Array | null>(null)
const maskSourceId = ref<string>('')

/** ソース画像から全ピクセルのバンドマスクを一括計算 */
function buildBandMask(): Uint8Array {
  const { imageData, colorSpace } = props.source
  const { data, width, height } = imageData
  const toOklch = createPixelConverter(colorSpace)
  const pixelCount = width * height
  const mask = new Uint8Array(pixelCount)

  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4
    const a = data[off + 3]!
    if (a < 128) {
      mask[i] = 255
      continue
    }
    const result = toOklch(data[off]!, data[off + 1]!, data[off + 2]!)
    if (!result) { mask[i] = 255; continue }
    const l = result.l
    if (l < 0.35) mask[i] = 0       // dark
    else if (l < 0.65) mask[i] = 1  // mid
    else mask[i] = 2                // light
  }
  return mask
}

const BAND_INDEX: Record<string, number> = { dark: 0, mid: 1, light: 2 }

// ソース変更時にマスクを再計算
watch(
  () => props.source,
  () => {
    const id = `${props.source.imageData.width}x${props.source.imageData.height}_${props.source.colorSpace}`
    if (maskSourceId.value !== id) {
      bandMask.value = buildBandMask()
      maskSourceId.value = id
    }
  },
  { immediate: true },
)

// バンド切替時: キャッシュ済みマスクで高速描画
watch(
  [() => props.activeBand, bandMask],
  async () => {
    if (props.activeBand === 'all') return
    await nextTick()
    render()
  },
  { immediate: true },
)

function render() {
  const canvas = canvasRef.value
  const mask = bandMask.value
  if (!canvas || !mask) return

  const { imageData } = props.source
  const { data, width, height } = imageData
  const bandIdx = BAND_INDEX[props.activeBand]
  if (bandIdx === undefined) return

  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const out = ctx.createImageData(width, height)
  const outData = out.data
  const pixelCount = width * height

  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4
    if (mask[i] === bandIdx) {
      outData[off] = data[off]!
      outData[off + 1] = data[off + 1]!
      outData[off + 2] = data[off + 2]!
      outData[off + 3] = 255
    } else {
      outData[off] = 255; outData[off + 1] = 255; outData[off + 2] = 255; outData[off + 3] = 255
    }
  }

  ctx.putImageData(out, 0, 0)
}
</script>
