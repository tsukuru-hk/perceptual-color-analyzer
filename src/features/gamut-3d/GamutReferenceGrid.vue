<template>
  <primitive v-if="group" :object="group" />
</template>

<script setup lang="ts">
import { shallowRef, watch, toRef, onScopeDispose } from 'vue'
import {
  Group,
  LineSegments,
  LineBasicMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  SphereGeometry,
  MeshBasicMaterial,
  Matrix4,
  Color,
  Vector3,
} from 'three'
import { oklch, formatHex } from 'culori'
import { oklchToPosition, DEFAULT_GAMUT_SCALE } from '@/domain/oklchTo3d'
import { computeGamutBoundary } from '@/infrastructure/gamutBoundaryCalculator'
import type { ColorSpace } from '@/domain/colorSpace'

const props = withDefaults(defineProps<{
  colorSpace?: ColorSpace
}>(), {
  colorSpace: 'srgb',
})

/** 境界の Lightness 分割数 */
const L_STEPS = 16
/** 境界の Hue 分割数 */
const H_STEPS = 36
/** 境界ドットの半径 */
const DOT_RADIUS = 0.008
/** L 軸の半分の高さ */
const HALF_HEIGHT = 0.5 * DEFAULT_GAMUT_SCALE.lightnessScale

const sphereGeo = new SphereGeometry(1, 6, 4)

/**
 * OKLCH 値から sRGB hex を取得。ガマット外なら null。
 */
function oklchToHex(l: number, c: number, h: number): string | null {
  const color = oklch({ mode: 'oklch', l, c, h })
  if (!color) return null
  return formatHex(color)
}

function buildGroup(colorSpace: ColorSpace): Group {
  const root = new Group()
  const boundary = computeGamutBoundary(colorSpace, L_STEPS, H_STEPS)

  const linePositions: number[] = []
  const lineColors: number[] = []
  const dots: { x: number; y: number; z: number; hex: string }[] = []

  const { lightnessLevels, hueSteps, maxChroma } = boundary

  // --- 横リング（同一 L レベルの境界点を接続） ---
  for (let li = 0; li < lightnessLevels.length; li++) {
    const l = lightnessLevels[li]!

    for (let hi = 0; hi < hueSteps.length; hi++) {
      const hiNext = (hi + 1) % hueSteps.length
      const h1 = hueSteps[hi]!
      const h2 = hueSteps[hiNext]!
      const c1 = maxChroma[li]![hi]!
      const c2 = maxChroma[li]![hiNext]!

      // Chroma が 0 に近い場合（L=0 or L=1 付近）はスキップ
      if (c1 < 0.002 && c2 < 0.002) continue

      const p1 = oklchToPosition(l, c1, h1, DEFAULT_GAMUT_SCALE)
      const p2 = oklchToPosition(l, c2, h2, DEFAULT_GAMUT_SCALE)

      // ラインの色（境界上の色を使用、ガマット外ならグレー）
      const hex1 = oklchToHex(l, Math.max(c1 - 0.01, 0), h1) ?? '#888888'
      const hex2 = oklchToHex(l, Math.max(c2 - 0.01, 0), h2) ?? '#888888'
      const col1 = new Color(hex1)
      const col2 = new Color(hex2)

      linePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
      lineColors.push(col1.r, col1.g, col1.b, col2.r, col2.g, col2.b)

      // ドット（始点のみ）
      if (c1 >= 0.002) {
        dots.push({ x: p1.x, y: p1.y, z: p1.z, hex: hex1 })
      }
    }
  }

  // --- 縦リブ（同一 Hue の境界点を L 方向に接続） ---
  // 全 Hue ではなく間引いて描画（視認性のため）
  const RIB_INTERVAL = 3 // 3 ステップごとにリブ
  for (let hi = 0; hi < hueSteps.length; hi += RIB_INTERVAL) {
    const h = hueSteps[hi]!

    for (let li = 0; li < lightnessLevels.length - 1; li++) {
      const l1 = lightnessLevels[li]!
      const l2 = lightnessLevels[li + 1]!
      const c1 = maxChroma[li]![hi]!
      const c2 = maxChroma[li + 1]![hi]!

      if (c1 < 0.002 && c2 < 0.002) continue

      const p1 = oklchToPosition(l1, c1, h, DEFAULT_GAMUT_SCALE)
      const p2 = oklchToPosition(l2, c2, h, DEFAULT_GAMUT_SCALE)

      const hex1 = oklchToHex(l1, Math.max(c1 - 0.01, 0), h) ?? '#888888'
      const hex2 = oklchToHex(l2, Math.max(c2 - 0.01, 0), h) ?? '#888888'
      const col1 = new Color(hex1)
      const col2 = new Color(hex2)

      linePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
      lineColors.push(col1.r, col1.g, col1.b, col2.r, col2.g, col2.b)
    }
  }

  // --- ワイヤーフレームライン ---
  if (linePositions.length > 0) {
    const lineGeo = new BufferGeometry()
    lineGeo.setAttribute('position', new Float32BufferAttribute(linePositions, 3))
    lineGeo.setAttribute('color', new Float32BufferAttribute(lineColors, 3))
    const lineMat = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4 })
    root.add(new LineSegments(lineGeo, lineMat))
  }

  // --- 境界ドット（InstancedMesh） ---
  if (dots.length > 0) {
    const dotMat = new MeshBasicMaterial({ transparent: true, opacity: 0.35 })
    const im = new InstancedMesh(sphereGeo, dotMat, dots.length)
    const m = new Matrix4()
    const pos = new Vector3()
    const color = new Color()

    for (let i = 0; i < dots.length; i++) {
      const d = dots[i]!
      pos.set(d.x, d.y, d.z)
      m.makeScale(DOT_RADIUS, DOT_RADIUS, DOT_RADIUS)
      m.setPosition(pos)
      im.setMatrixAt(i, m)
      color.set(d.hex)
      im.setColorAt(i, color)
    }
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    root.add(im)
  }

  // --- 中心 L 軸 ---
  const axisGeo = new BufferGeometry()
  axisGeo.setAttribute('position', new Float32BufferAttribute([
    0, -HALF_HEIGHT, 0,
    0, HALF_HEIGHT, 0,
  ], 3))
  root.add(new LineSegments(axisGeo, new LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.5 })))

  return root
}

const group = shallowRef<Group | null>(null)

function disposeGroupObj(g: Group | null) {
  if (!g) return
  g.traverse((obj) => {
    if ('geometry' in obj && obj.geometry) (obj as any).geometry.dispose()
    if ('material' in obj && obj.material) (obj as any).material.dispose()
    if (obj instanceof InstancedMesh) obj.dispose()
  })
}

watch(toRef(props, 'colorSpace'), (cs) => {
  disposeGroupObj(group.value)
  group.value = buildGroup(cs)
}, { immediate: true })

onScopeDispose(() => {
  disposeGroupObj(group.value)
  sphereGeo.dispose()
})
</script>
