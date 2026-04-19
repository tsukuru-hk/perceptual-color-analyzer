<template>
  <primitive v-if="mesh" :object="mesh" />
</template>

<script setup lang="ts">
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

const POINT_SIZE = 0.025

const props = defineProps<{
  data: GamutPointCloudData | null
}>()

const mesh = shallowRef<InstancedMesh | null>(null)

const sphereGeo = new SphereGeometry(1, 8, 6)
const material = new MeshBasicMaterial()

function buildMesh(data: GamutPointCloudData): InstancedMesh {
  const im = new InstancedMesh(sphereGeo, material, data.count)

  const m = new Matrix4()
  const pos = new Vector3()
  const color = new Color()

  for (let i = 0; i < data.count; i++) {
    const i3 = i * 3
    pos.set(data.positions[i3]!, data.positions[i3 + 1]!, data.positions[i3 + 2]!)
    m.makeScale(POINT_SIZE, POINT_SIZE, POINT_SIZE)
    m.setPosition(pos)
    im.setMatrixAt(i, m)

    color.setRGB(data.colors[i3]!, data.colors[i3 + 1]!, data.colors[i3 + 2]!, SRGBColorSpace)
    im.setColorAt(i, color)
  }

  im.instanceMatrix.needsUpdate = true
  if (im.instanceColor) im.instanceColor.needsUpdate = true

  return im
}

watch(toRef(props, 'data'), (newData) => {
  if (mesh.value) {
    mesh.value.dispose()
  }
  if (!newData || newData.count === 0) {
    mesh.value = null
    return
  }
  mesh.value = buildMesh(newData)
}, { immediate: true })

onScopeDispose(() => {
  if (mesh.value) mesh.value.dispose()
  sphereGeo.dispose()
  material.dispose()
})
</script>
