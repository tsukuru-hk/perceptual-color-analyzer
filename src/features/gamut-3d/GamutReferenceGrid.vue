<template>
  <primitive v-if="group" :object="group" />
</template>

<script setup lang="ts">
import { shallowRef, watch, toRef, onScopeDispose } from 'vue'
import {
  Group,
  Line,
  LineSegments,
  LineLoop,
  LineBasicMaterial,
  LineDashedMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  SphereGeometry,
  MeshBasicMaterial,
  Matrix4,
  Color,
  Vector3,
  Sprite,
  SpriteMaterial,
  CanvasTexture,
} from 'three'
import { oklch, formatHex, converter } from 'culori'
import { oklchToPosition, DEFAULT_GAMUT_SCALE } from '@/domain/oklchTo3d'
import { computeGamutBoundary, computeMaxChromaCusp } from '@/infrastructure/gamutBoundaryCalculator'
import type { CuspPoint } from '@/infrastructure/gamutBoundaryCalculator'
import type { WireframeGamut } from '@/domain/colorSpace'

const props = withDefaults(defineProps<{
  wireframeGamut?: WireframeGamut
}>(), {
  wireframeGamut: 'srgb',
})

/** 境界の Lightness 分割数 */
const L_STEPS = 16
/** 境界の Hue 分割数 */
const H_STEPS = 36
/** 境界ドットの半径 */
const DOT_RADIUS = 0.016
/** L 軸の半分の高さ */
const HALF_HEIGHT = 0.5 * DEFAULT_GAMUT_SCALE.lightnessScale

const sphereGeo = new SphereGeometry(1, 6, 4)

/** HSL 最大彩度リングの三角マーカー数（弧長で等間隔配置） */
const HSL_MARKER_COUNT = 36
/** 三角マーカーの表示サイズ（ワールド単位） */
const HSL_MARKER_SIZE = 0.08

/** 正三角形を描いた白テクスチャ。Sprite に貼って常にカメラを向かせる。 */
function makeTriangleTexture(): CanvasTexture {
  const S = 64
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3
    const x = S / 2 + (S * 0.44) * Math.cos(a)
    const y = S / 2 + (S * 0.44) * Math.sin(a)
    if (k === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  return new CanvasTexture(canvas)
}
const triangleTexture = makeTriangleTexture()

/**
 * OKLCH 値から sRGB hex を取得。ガマット外なら null。
 */
function oklchToHex(l: number, c: number, h: number): string | null {
  const color = oklch({ mode: 'oklch', l, c, h })
  if (!color) return null
  return formatHex(color)
}

/** Rec.601 luma 係数（gamma 補正済み R'G'B' に対する重み） */
const REC601_LUMA = { r: 0.299, g: 0.587, b: 0.114 } as const

/** OKLCH → sRGB 変換器 */
const toRgb = converter('rgb')

/** 任意色 → OKLCH 変換器（HSL 色を円柱座標へ載せるのに使用） */
const toOklch = converter('oklch')

/**
 * OKLCH 境界色の Rec.601 luma (0–1) を返す。
 * sRGB ガマット外はチャンネルをクランプして近似する。
 */
function rec601Luma(l: number, c: number, h: number): number {
  const col = toRgb({ mode: 'oklch', l, c, h })
  if (!col) return l
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return REC601_LUMA.r * clamp(col.r) + REC601_LUMA.g * clamp(col.g) + REC601_LUMA.b * clamp(col.b)
}

/**
 * 縦軸に使う明度を返す。
 * `lch-rec601` モードでは OKLCH の L ではなく Rec.601 luma を高さに使い、
 * それ以外はそのまま OKLCH の L を使う。
 */
function heightL(gamut: WireframeGamut, l: number, c: number, h: number): number {
  if (gamut === 'lch-rec601') return rec601Luma(l, c, h)
  return l
}

/** カスプ軌跡の点密度（弧長で等間隔に敷き詰める点数） */
const CUSP_DOT_COUNT = 240
/** カスプ軌跡ドットの半径（境界ドットより大きく強調） */
const CUSP_DOT_RADIUS = 0.013

/**
 * 閉ループ状の点列を弧長で等間隔にリサンプルするための (区間index, 補間t) を返す。
 * 点を「満遍なく敷き詰める」ために、彩度差で密度が偏らないよう距離基準で分配する。
 */
function resampleClosedLoop(positions: Vector3[], count: number): { i: number; t: number }[] {
  const n = positions.length
  const seg: number[] = []
  let total = 0
  for (let i = 0; i < n; i++) {
    const d = positions[i]!.distanceTo(positions[(i + 1) % n]!)
    seg.push(d)
    total += d
  }
  const out: { i: number; t: number }[] = []
  if (total <= 0) return out

  const step = total / count
  let i = 0
  let acc = 0
  for (let k = 0; k < count; k++) {
    const target = k * step
    while (i < n - 1 && acc + seg[i]! < target) {
      acc += seg[i]!
      i++
    }
    const denom = seg[i]! || 1
    const t = Math.min(1, Math.max(0, (target - acc) / denom))
    out.push({ i, t })
  }
  return out
}

/**
 * Rec.601 の最高彩度軌跡（実線＝敷き詰めた点）と、
 * 参考として OKLCH の最高彩度軌跡（点線）を描画する。
 *
 * 2 本の軌跡は同じ (L, C, H) カスプ点を共有し、縦軸だけが異なる:
 *   - Rec.601: 高さ = Rec.601 luma
 *   - OKLCH:   高さ = OKLCH L
 * これにより「最高彩度線の軌道が明度定義でどう変わるか」を比較できる。
 */
function addCuspCurves(root: Group): void {
  const cusps: CuspPoint[] = computeMaxChromaCusp('lch-rec601')

  const rec601Pos: Vector3[] = []
  const oklchPos: Vector3[] = []
  const colors: Color[] = []

  for (const { l, c, h } of cusps) {
    if (c < 0.002) continue
    const pr = oklchToPosition(rec601Luma(l, c, h), c, h, DEFAULT_GAMUT_SCALE)
    const po = oklchToPosition(l, c, h, DEFAULT_GAMUT_SCALE)
    rec601Pos.push(new Vector3(pr.x, pr.y, pr.z))
    oklchPos.push(new Vector3(po.x, po.y, po.z))
    const hex = oklchToHex(l, Math.max(c - 0.01, 0), h) ?? '#888888'
    colors.push(new Color(hex))
  }
  if (rec601Pos.length < 2) return

  // --- Rec.601 軌跡: 弧長等間隔の実線＋敷き詰めドット ---
  const samples = resampleClosedLoop(rec601Pos, CUSP_DOT_COUNT)
  const n = rec601Pos.length
  const dotMat = new MeshBasicMaterial({ transparent: true, opacity: 0.95 })
  const im = new InstancedMesh(sphereGeo, dotMat, samples.length)
  const m = new Matrix4()
  const pos = new Vector3()
  const col = new Color()
  for (let k = 0; k < samples.length; k++) {
    const { i, t } = samples[k]!
    pos.copy(rec601Pos[i]!).lerp(rec601Pos[(i + 1) % n]!, t)
    m.makeScale(CUSP_DOT_RADIUS, CUSP_DOT_RADIUS, CUSP_DOT_RADIUS)
    m.setPosition(pos)
    im.setMatrixAt(k, m)
    col.copy(colors[i]!).lerp(colors[(i + 1) % n]!, t)
    im.setColorAt(k, col)
  }
  im.instanceMatrix.needsUpdate = true
  if (im.instanceColor) im.instanceColor.needsUpdate = true
  root.add(im)

  // 敷き詰めた点を繋ぐ細い実線（連続した軌道として読み取れるように）
  const rec601LinePos: number[] = []
  const rec601LineCol: number[] = []
  for (let i = 0; i < n; i++) {
    const p = rec601Pos[i]!
    const cc = colors[i]!
    rec601LinePos.push(p.x, p.y, p.z)
    rec601LineCol.push(cc.r, cc.g, cc.b)
  }
  const rec601Geo = new BufferGeometry()
  rec601Geo.setAttribute('position', new Float32BufferAttribute(rec601LinePos, 3))
  rec601Geo.setAttribute('color', new Float32BufferAttribute(rec601LineCol, 3))
  root.add(new LineLoop(rec601Geo, new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 })))

  // --- OKLCH 軌跡: 参考の点線（閉ループを明示的に閉じてから距離計算） ---
  const oklchLinePos: number[] = []
  const oklchLineCol: number[] = []
  const pushVert = (i: number) => {
    const p = oklchPos[i]!
    const cc = colors[i]!
    oklchLinePos.push(p.x, p.y, p.z)
    oklchLineCol.push(cc.r, cc.g, cc.b)
  }
  for (let i = 0; i < n; i++) pushVert(i)
  pushVert(0) // ループを閉じる
  const oklchGeo = new BufferGeometry()
  oklchGeo.setAttribute('position', new Float32BufferAttribute(oklchLinePos, 3))
  oklchGeo.setAttribute('color', new Float32BufferAttribute(oklchLineCol, 3))
  const oklchLine = new Line(
    oklchGeo,
    new LineDashedMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      dashSize: 0.07,
      gapSize: 0.09,
    }),
  )
  oklchLine.computeLineDistances()
  root.add(oklchLine)
}

/**
 * sRGB における HSL の最大彩度色（S=1, L=0.5）の軌跡を描画する。
 *
 * HSL では最大彩度が常に L=0.5 で頭打ちになるため、この軌跡は
 * 軸に垂直な水平面（中央平面 y=0）にしか載らない。フラットなリングとして
 * 見せることで「HSL の最高彩度線は 1 枚の平面上に固定される」ことを示す。
 * 半径・角度は OKLCH の C・H を使い、他の軌跡と同じ円柱座標系に載せる。
 *
 * 参考なので点線。ただし点は三角マーカーで区別する。
 */
function addHslSaturationRing(root: Group): void {
  const HUE_STEPS = 180
  const positions: Vector3[] = []
  const colors: Color[] = []

  for (let i = 0; i < HUE_STEPS; i++) {
    const hHsl = (i / HUE_STEPS) * 360
    const ok = toOklch({ mode: 'hsl', h: hHsl, s: 1, l: 0.5 })
    if (!ok) continue
    // 高さは HSL の L=0.5 に固定 → 常に中央平面（軸に垂直）に載る
    const p = oklchToPosition(0.5, ok.c ?? 0, ok.h ?? 0, DEFAULT_GAMUT_SCALE)
    positions.push(new Vector3(p.x, p.y, p.z))
    colors.push(new Color(formatHex({ mode: 'hsl', h: hHsl, s: 1, l: 0.5 }) ?? '#888888'))
  }
  if (positions.length < 2) return

  // --- 参考の点線（水平面上のフラットなリング） ---
  const linePos: number[] = []
  const lineCol: number[] = []
  const pushVert = (i: number) => {
    const p = positions[i]!
    const cc = colors[i]!
    linePos.push(p.x, p.y, p.z)
    lineCol.push(cc.r, cc.g, cc.b)
  }
  for (let i = 0; i < positions.length; i++) pushVert(i)
  pushVert(0) // ループを閉じる
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(linePos, 3))
  geo.setAttribute('color', new Float32BufferAttribute(lineCol, 3))
  const line = new Line(
    geo,
    new LineDashedMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      dashSize: 0.07,
      gapSize: 0.09,
    }),
  )
  line.computeLineDistances()
  root.add(line)

  // --- 三角マーカー（弧長で等間隔、Sprite なので常にカメラを向く） ---
  const samples = resampleClosedLoop(positions, HSL_MARKER_COUNT)
  const n = positions.length
  const pos = new Vector3()
  const col = new Color()
  for (let k = 0; k < samples.length; k++) {
    const { i, t } = samples[k]!
    pos.copy(positions[i]!).lerp(positions[(i + 1) % n]!, t)
    col.copy(colors[i]!).lerp(colors[(i + 1) % n]!, t)
    const sprite = new Sprite(
      new SpriteMaterial({ map: triangleTexture, color: col.clone(), transparent: true, opacity: 0.95 }),
    )
    sprite.position.copy(pos)
    sprite.scale.set(HSL_MARKER_SIZE, HSL_MARKER_SIZE, 1)
    root.add(sprite)
  }
}

function buildGroup(wireframeGamut: WireframeGamut): Group {
  const root = new Group()
  const boundary = computeGamutBoundary(wireframeGamut, L_STEPS, H_STEPS)

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

      const p1 = oklchToPosition(heightL(wireframeGamut, l, c1, h1), c1, h1, DEFAULT_GAMUT_SCALE)
      const p2 = oklchToPosition(heightL(wireframeGamut, l, c2, h2), c2, h2, DEFAULT_GAMUT_SCALE)

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

      const p1 = oklchToPosition(heightL(wireframeGamut, l1, c1, h), c1, h, DEFAULT_GAMUT_SCALE)
      const p2 = oklchToPosition(heightL(wireframeGamut, l2, c2, h), c2, h, DEFAULT_GAMUT_SCALE)

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

  // --- 実験モード: Rec.601 最高彩度軌跡（実線）＋ OKLCH 参考軌跡（点線） ---
  if (wireframeGamut === 'lch-rec601') {
    addCuspCurves(root)
    addHslSaturationRing(root)
  }

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

watch(toRef(props, 'wireframeGamut'), (wg) => {
  disposeGroupObj(group.value)
  group.value = buildGroup(wg)
}, { immediate: true })

onScopeDispose(() => {
  disposeGroupObj(group.value)
  sphereGeo.dispose()
  triangleTexture.dispose()
})
</script>
