<template>
  <primitive v-if="group" :object="group" />
</template>

<script setup lang="ts">
import { shallowRef, onScopeDispose } from 'vue'
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


/** 色相リングの Lightness レベル数 */
const LIGHTNESS_LEVELS = 7
/** 各リングの色相分割数 */
const HUE_STEPS = 24
/** リファレンスの Chroma */
const REF_CHROMA = 0.15
/** リファレンスドットの半径 */
const DOT_RADIUS = 0.012
/** L 軸の半分の高さ */
const HALF_HEIGHT = 0.5 * DEFAULT_GAMUT_SCALE.lightnessScale

const sphereGeo = new SphereGeometry(1, 6, 4)

/**
 * OKLCH 値から sRGB hex を取得。ガマット外なら null。
 */
function oklchToHex(l: number, c: number, h: number): string | null {
  const color = oklch({ mode: 'oklch', l, c, h })
  if (!color) return null
  const hex = formatHex(color)
  return hex
}

function buildGroup(): Group {
  const root = new Group()

  // --- 色付きリングのライン + ドット ---
  const dots: { x: number; y: number; z: number; hex: string }[] = []
  const lineColors: number[] = []
  const linePositions: number[] = []

  for (let li = 0; li < LIGHTNESS_LEVELS; li++) {
    const l = li / (LIGHTNESS_LEVELS - 1)

    for (let hi = 0; hi < HUE_STEPS; hi++) {
      const h1 = (hi / HUE_STEPS) * 360
      const h2 = ((hi + 1) / HUE_STEPS) * 360

      const hex1 = oklchToHex(l, REF_CHROMA, h1)
      const hex2 = oklchToHex(l, REF_CHROMA, h2)
      if (!hex1 || !hex2) continue

      const p1 = oklchToPosition(l, REF_CHROMA, h1, DEFAULT_GAMUT_SCALE)
      const p2 = oklchToPosition(l, REF_CHROMA, h2, DEFAULT_GAMUT_SCALE)

      // ライン（セグメントの色はセグメント始点の色）
      linePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
      const c1 = new Color(hex1)
      const c2 = new Color(hex2)
      lineColors.push(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b)

      // ドット（始点のみ。最後のセグメントで終点は始点と同じ）
      dots.push({ x: p1.x, y: p1.y, z: p1.z, hex: hex1 })
    }
  }

  // 色付きリングライン
  if (linePositions.length > 0) {
    const lineGeo = new BufferGeometry()
    lineGeo.setAttribute('position', new Float32BufferAttribute(linePositions, 3))
    lineGeo.setAttribute('color', new Float32BufferAttribute(lineColors, 3))
    const lineMat = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6 })
    root.add(new LineSegments(lineGeo, lineMat))
  }

  // 色付きドット（InstancedMesh）
  if (dots.length > 0) {
    const dotMat = new MeshBasicMaterial({ transparent: true, opacity: 0.5 })
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

const group = shallowRef<Group>(buildGroup())

onScopeDispose(() => {
  if (group.value) {
    group.value.traverse((obj) => {
      if ('geometry' in obj && obj.geometry) (obj as any).geometry.dispose()
      if ('material' in obj && obj.material) (obj as any).material.dispose()
      if (obj instanceof InstancedMesh) obj.dispose()
    })
  }
  sphereGeo.dispose()
})
</script>
