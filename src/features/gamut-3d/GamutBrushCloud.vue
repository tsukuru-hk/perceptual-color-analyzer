<template>
  <primitive v-if="mesh" :object="mesh" />
</template>

<script setup lang="ts">
/**
 * ブラシで追加されたポイントを描画する InstancedMesh。
 * 容量を最大値で 1 度だけ確保し、データ追加時は差分のみ行列・色を更新する
 * インクリメンタル更新方式（O(addedCount)）。
 */
import { shallowRef, watch, toRef, onScopeDispose } from 'vue'
import {
  InstancedMesh,
  SphereGeometry,
  MeshBasicMaterial,
  Matrix4,
  Color,
  Vector3,
  SRGBColorSpace,
} from 'three'
import type { GamutPointCloudData } from '@/types/analysis'
import { MAX_BRUSH_POINTS } from './composables/useGamutBrush'

const POINT_SIZE = 0.03

const props = defineProps<{
  data: GamutPointCloudData
}>()

const mesh = shallowRef<InstancedMesh | null>(null)

const sphereGeo = new SphereGeometry(1, 8, 6)
const material = new MeshBasicMaterial()

/** InstancedMesh 容量。`useGamutBrush` の上限と同値 */
const CAPACITY = MAX_BRUSH_POINTS

/** 現在描画範囲の先頭から何個まで行列/色を書き込み済みか */
let writtenCount = 0
/** 前回観察した positions/colors のバッファ参照。変わったら全再構築 */
let lastPositions: Float32Array | null = null
let lastColors: Float32Array | null = null

const mBuf = new Matrix4()
const posBuf = new Vector3()
const colorBuf = new Color()

function ensureMesh(): InstancedMesh {
  if (mesh.value) return mesh.value
  const im = new InstancedMesh(sphereGeo, material, CAPACITY)
  im.count = 0
  mesh.value = im
  return im
}

function writeRange(
  im: InstancedMesh,
  data: GamutPointCloudData,
  from: number,
  to: number,
): void {
  for (let i = from; i < to; i++) {
    const i3 = i * 3
    posBuf.set(data.positions[i3]!, data.positions[i3 + 1]!, data.positions[i3 + 2]!)
    mBuf.makeScale(POINT_SIZE, POINT_SIZE, POINT_SIZE)
    mBuf.setPosition(posBuf)
    im.setMatrixAt(i, mBuf)

    colorBuf.setRGB(data.colors[i3]!, data.colors[i3 + 1]!, data.colors[i3 + 2]!, SRGBColorSpace)
    im.setColorAt(i, colorBuf)
  }
}

function applyData(data: GamutPointCloudData): void {
  const im = ensureMesh()

  // バッファ参照が変わった（＝別画像へ切替 or clear 後の初回追加）→ 先頭から書き直し
  const bufferChanged = data.positions !== lastPositions || data.colors !== lastColors
  if (bufferChanged) {
    writtenCount = 0
    lastPositions = data.positions
    lastColors = data.colors
  }

  const targetCount = Math.min(data.count, CAPACITY)

  if (targetCount < writtenCount) {
    // count が減った（clear 等）: 次の追加時に再書き込みされるため writtenCount をリセット
    writtenCount = targetCount
  } else if (targetCount > writtenCount) {
    writeRange(im, data, writtenCount, targetCount)
    writtenCount = targetCount
  }

  if (im.count !== targetCount) {
    im.count = targetCount
  }
  im.instanceMatrix.needsUpdate = true
  if (im.instanceColor) im.instanceColor.needsUpdate = true
}

watch(toRef(props, 'data'), (newData) => {
  applyData(newData)
}, { immediate: true })

onScopeDispose(() => {
  if (mesh.value) mesh.value.dispose()
  sphereGeo.dispose()
  material.dispose()
  lastPositions = null
  lastColors = null
})
</script>
