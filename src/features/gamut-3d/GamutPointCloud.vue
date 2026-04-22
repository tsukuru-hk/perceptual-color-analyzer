<template>
  <primitive v-if="mesh" :object="mesh" />
</template>

<script lang="ts">
/**
 * アニメーション済みのデータを追跡するグローバル WeakSet。
 * 同じ `GamutPointCloudData` オブジェクトが再マウントされた際に
 * 二度目以降はアニメーションをスキップするためにモジュールレベルで保持する。
 */
const animatedData = new WeakSet<object>()
</script>

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
  InstancedBufferAttribute,
} from 'three'
import { useLoop } from '@tresjs/core'
import type { GamutPointCloudData } from '@/types/analysis'

const POINT_SIZE = 0.025

/** アニメーション全体の尺（秒）— 下端→上端のディレイ幅 */
const STAGGER_DURATION = 1.7
/** 各ポイントのバウンスアニメーション尺（秒） */
const BOUNCE_DURATION = 0.3
/** オーバーシュートのピーク倍率 */
const OVERSHOOT_SCALE = 1.3

const props = defineProps<{
  data: GamutPointCloudData | null
}>()

const emit = defineEmits<{
  'animation-start': []
  'animation-end': []
}>()

const mesh = shallowRef<InstancedMesh | null>(null)

const sphereGeo = new SphereGeometry(1, 8, 6)

/* ---------- material with custom animation shader injection ---------- */
// uniforms は参照共有で値のみ更新するため、needsUpdate を立てずに済む。
const timeUniform = { value: 0 }
const animatingUniform = { value: 1 }
const bounceDurationUniform = { value: BOUNCE_DURATION }
const overshootUniform = { value: OVERSHOOT_SCALE }

const material = new MeshBasicMaterial()
material.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = timeUniform
  shader.uniforms.uAnimating = animatingUniform
  shader.uniforms.uBounceDuration = bounceDurationUniform
  shader.uniforms.uOvershoot = overshootUniform

  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    /* glsl */ `
      #include <common>
      attribute float instanceDelay;
      uniform float uTime;
      uniform float uAnimating;
      uniform float uBounceDuration;
      uniform float uOvershoot;
    `,
  )

  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    /* glsl */ `
      #include <begin_vertex>

      if (uAnimating > 0.5) {
        float t = uTime - instanceDelay;
        float s;
        if (t < 0.0) {
          s = 0.0;
        } else if (t < uBounceDuration) {
          float p = t / uBounceDuration;
          if (p < 0.5) {
            float q = p * 2.0;
            s = uOvershoot * (1.0 - pow(1.0 - q, 3.0));
          } else {
            float q = (p - 0.5) * 2.0;
            s = mix(uOvershoot, 1.0, q * q * (3.0 - 2.0 * q));
          }
        } else {
          s = 1.0;
        }
        transformed *= s;
      }
    `,
  )
}

/* ---------- build instanced mesh ---------- */
function buildMesh(data: GamutPointCloudData): InstancedMesh {
  const im = new InstancedMesh(sphereGeo, material, data.count)

  const m = new Matrix4()
  const pos = new Vector3()
  const color = new Color()

  let yMin = Infinity
  let yMax = -Infinity
  for (let i = 0; i < data.count; i++) {
    const y = data.positions[i * 3 + 1]!
    if (y < yMin) yMin = y
    if (y > yMax) yMax = y
  }
  const yRange = yMax - yMin || 1

  const delays = new Float32Array(data.count)

  for (let i = 0; i < data.count; i++) {
    const i3 = i * 3
    const y = data.positions[i3 + 1]!
    pos.set(data.positions[i3]!, y, data.positions[i3 + 2]!)
    m.makeScale(POINT_SIZE, POINT_SIZE, POINT_SIZE)
    m.setPosition(pos)
    im.setMatrixAt(i, m)

    color.setRGB(data.colors[i3]!, data.colors[i3 + 1]!, data.colors[i3 + 2]!, SRGBColorSpace)
    im.setColorAt(i, color)

    // Y が低い（暗い）ほどディレイ 0、高い（明るい）ほどディレイ大
    delays[i] = ((y - yMin) / yRange) * STAGGER_DURATION
  }

  sphereGeo.setAttribute('instanceDelay', new InstancedBufferAttribute(delays, 1))

  im.instanceMatrix.needsUpdate = true
  if (im.instanceColor) im.instanceColor.needsUpdate = true

  return im
}

/* ---------- animation loop ---------- */
let animStartTime = -1

const { onBeforeRender } = useLoop()

onBeforeRender(({ elapsed }) => {
  if (!mesh.value) return
  if (animatingUniform.value < 0.5) return

  if (animStartTime < 0) {
    animStartTime = elapsed
  }

  const t = elapsed - animStartTime
  timeUniform.value = t

  if (t > STAGGER_DURATION + BOUNCE_DURATION + 0.1) {
    animatingUniform.value = 0
    if (props.data) animatedData.add(props.data)
    emit('animation-end')
  }
})

/* ---------- data watch ---------- */
watch(toRef(props, 'data'), (newData) => {
  if (mesh.value) {
    mesh.value.dispose()
  }
  if (!newData || newData.count === 0) {
    mesh.value = null
    return
  }

  if (!animatedData.has(newData)) {
    animStartTime = -1
    timeUniform.value = 0
    animatingUniform.value = 1
    emit('animation-start')
  } else {
    animatingUniform.value = 0
  }

  mesh.value = buildMesh(newData)
}, { immediate: true })

onScopeDispose(() => {
  if (mesh.value) mesh.value.dispose()
  sphereGeo.dispose()
  material.dispose()
})
</script>
