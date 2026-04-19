<template>
  <!--
    色相分析の3D地形チャート:
    白い地面（ディスク）の上に、密度に応じた鮮やかな山が立ち上がる。
    蜘蛛の巣状の色付きグリッドで色相・彩度のガイドを表示。
    外周に土星リング風の色相環。
  -->
  <div class="relative w-full" :style="height ? { height: height + 'px' } : undefined" :class="{ 'h-full': !height }">
    <TresCanvas
      v-if="isMounted && terrainMesh"
      :clear-color="'#808080'"
      :style="{ width: '100%', height: '100%' }"
    >
      <primitive :object="camera" />
      <OrbitControls
        ref="orbitControlsRef"
        :enable-damping="true"
        :damping-factor="0.08"
        :max-polar-angle="Math.PI * 0.48"
        :min-distance="2"
        :max-distance="12"
      />

      <!-- 白い地面ディスク -->
      <primitive v-if="groundMesh" :object="groundMesh" />

      <!-- 蜘蛛の巣グリッド（色付き同心円 + 放射線） -->
      <primitive v-if="gridLines" :object="gridLines" />

      <!-- 地形メッシュ -->
      <primitive :object="terrainMesh" />

      <!-- 地形ワイヤーフレーム -->
      <primitive v-if="terrainWire" :object="terrainWire" />

      <!-- 外周の色相環リング（土星リング風） -->
      <primitive v-if="hueRingMesh" :object="hueRingMesh" />
    </TresCanvas>

    <!-- カメラリセットボタン -->
    <button
      v-if="isMounted && terrainMesh"
      class="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-black/40 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
      title="カメラ位置をリセット"
      @click="resetCamera"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
    </button>

    <div v-if="!(isMounted && terrainMesh)" class="flex h-full items-center justify-center text-sm text-muted-foreground">
      地形データを構築中...
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, shallowRef, ref, onMounted, onScopeDispose } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  LineSegments,
  LineBasicMaterial,
  WireframeGeometry,
  DoubleSide,
  SRGBColorSpace,
  Color,
  PerspectiveCamera,
  Vector3,
} from 'three'
import type { HueAnalysisResult, PolarDensityCell } from '@/types/hueAnalysis'

const props = defineProps<{
  data: HueAnalysisResult
  activeBand: 'all' | 'dark' | 'mid' | 'light'
  height?: number
}>()

// === カメラ（永続オブジェクト — バンド切替時にリセットされない） ===
const INITIAL_CAM_POS = new Vector3(3, 3.5, 3)
const INITIAL_CAM_TARGET = new Vector3(0, 0, 0)

const camera = new PerspectiveCamera(35, 1, 0.1, 100)
camera.position.copy(INITIAL_CAM_POS)
camera.lookAt(INITIAL_CAM_TARGET)

const orbitControlsRef = ref<InstanceType<typeof OrbitControls> | null>(null)

function resetCamera() {
  camera.position.copy(INITIAL_CAM_POS)
  camera.lookAt(INITIAL_CAM_TARGET)
  const controls = (orbitControlsRef.value as any)?.value
  if (controls) {
    controls.target.copy(INITIAL_CAM_TARGET)
    controls.update()
  }
}

const ANGULAR_SEGMENTS = 180
const RADIAL_SEGMENTS = 60
const TERRAIN_RADIUS = 2.0
const HEIGHT_SCALE = 1.5
/** 色相環リングの距離 */
const RING_OFFSET = 0.06
const RING_WIDTH = 0.05

const activeDensityCells = computed<ReadonlyArray<PolarDensityCell>>(() => {
  if (props.activeBand === 'all') return props.data.densityCells
  const band = props.data.lightnessBands.find((b) => b.label === props.activeBand)
  return band?.densityCells ?? []
})

/** hueNorm (0-1) でのガマット最大彩度を補間取得 */
function sampleGamutMaxChroma(gamutMaxChroma: ReadonlyArray<number>, hueNorm: number): number {
  const n = gamutMaxChroma.length
  const hf = hueNorm * n
  const h0 = Math.floor(hf) % n
  const h1 = (h0 + 1) % n
  const t = hf - Math.floor(hf)
  return gamutMaxChroma[h0]! * (1 - t) + gamutMaxChroma[h1]! * t
}

/** hueNorm での最大半径 (TERRAIN_RADIUS に正規化) */
function gamutRadiusAt(gamutMaxChroma: ReadonlyArray<number>, globalMaxChroma: number, hueNorm: number): number {
  if (globalMaxChroma === 0) return TERRAIN_RADIUS
  return (sampleGamutMaxChroma(gamutMaxChroma, hueNorm) / globalMaxChroma) * TERRAIN_RADIUS
}

// === 密度グリッド + 補間 ===
function buildDensityGrid(cells: ReadonlyArray<PolarDensityCell>, hueBins: number, chromaBins: number): Float32Array {
  const grid = new Float32Array(hueBins * chromaBins)
  for (const cell of cells) {
    grid[cell.hueBin * chromaBins + cell.chromaBin] = cell.density
  }
  return grid
}

function sampleDensity(grid: Float32Array, hueBins: number, chromaBins: number, hueNorm: number, chromaNorm: number): number {
  const hf = hueNorm * hueBins
  const cf = chromaNorm * chromaBins
  const h0 = Math.floor(hf) % hueBins
  const h1 = (h0 + 1) % hueBins
  const c0 = Math.min(Math.floor(cf), chromaBins - 1)
  const c1 = Math.min(c0 + 1, chromaBins - 1)
  const ht = hf - Math.floor(hf)
  const ct = cf - Math.floor(cf)
  const v0 = grid[h0 * chromaBins + c0]! * (1 - ht) + grid[h1 * chromaBins + c0]! * ht
  const v1 = grid[h0 * chromaBins + c1]! * (1 - ht) + grid[h1 * chromaBins + c1]! * ht
  return v0 * (1 - ct) + v1 * ct
}

function sampleColor(
  wheelColors: ReadonlyArray<{ r: number; g: number; b: number }>,
  hueBins: number, chromaBins: number,
  hueNorm: number, chromaNorm: number,
): { r: number; g: number; b: number } {
  const hf = hueNorm * hueBins
  const cf = chromaNorm * chromaBins
  const h0 = Math.floor(hf) % hueBins
  const h1 = (h0 + 1) % hueBins
  const c0 = Math.min(Math.floor(cf), chromaBins - 1)
  const c1 = Math.min(c0 + 1, chromaBins - 1)
  const ht = hf - Math.floor(hf)
  const ct = cf - Math.floor(cf)
  const c00 = wheelColors[h0 * chromaBins + c0]!
  const c10 = wheelColors[h1 * chromaBins + c0]!
  const c01 = wheelColors[h0 * chromaBins + c1]!
  const c11 = wheelColors[h1 * chromaBins + c1]!
  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t
  return {
    r: lerp(lerp(c00.r, c10.r, ht), lerp(c01.r, c11.r, ht), ct),
    g: lerp(lerp(c00.g, c10.g, ht), lerp(c01.g, c11.g, ht), ct),
    b: lerp(lerp(c00.b, c10.b, ht), lerp(c01.b, c11.b, ht), ct),
  }
}

// === refs ===
const terrainMesh = shallowRef<Mesh | null>(null)
const terrainWire = shallowRef<LineSegments | null>(null)
const groundMesh = shallowRef<Mesh | null>(null)
const gridLines = shallowRef<LineSegments | null>(null)
const hueRingMesh = shallowRef<Mesh | null>(null)

// === 地形メッシュ ===
/** 明度帯に応じた色の明度スケーリング係数 */
function bandLightnessScale(): number {
  switch (props.activeBand) {
    case 'dark': return 0.45
    case 'mid': return 0.75
    case 'light': return 1.3
    default: return 1.0
  }
}

/** 明度帯に応じた地面の基底色 */
function bandBaseColor(): Color {
  const c = new Color()
  switch (props.activeBand) {
    case 'dark': c.setRGB(0.25, 0.25, 0.28, SRGBColorSpace); break
    case 'mid': c.setRGB(0.6, 0.6, 0.62, SRGBColorSpace); break
    case 'light': c.setRGB(0.95, 0.95, 0.95, SRGBColorSpace); break
    default: c.setRGB(0.95, 0.95, 0.95, SRGBColorSpace); break
  }
  return c
}

function buildTerrain() {
  const { hueBinCount, chromaBinCount, wheelColors, gamutMaxChroma, maxChroma } = props.data
  const densityGrid = buildDensityGrid(activeDensityCells.value, hueBinCount, chromaBinCount)
  const globalMaxC = Math.max(...gamutMaxChroma)
  const lScale = bandLightnessScale()

  const angSegs = ANGULAR_SEGMENTS
  const radSegs = RADIAL_SEGMENTS
  const vertexCount = (angSegs + 1) * (radSegs + 1)
  const positions = new Float32Array(vertexCount * 3)
  const colors = new Float32Array(vertexCount * 3)
  const baseGround = bandBaseColor()

  for (let ai = 0; ai <= angSegs; ai++) {
    const hueNorm = ai / angSegs
    const theta = hueNorm * Math.PI * 2
    const maxR = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm)
    // この色相でのガマット最大彩度
    const gamutC = sampleGamutMaxChroma(gamutMaxChroma, hueNorm)
    for (let ri = 0; ri <= radSegs; ri++) {
      const chromaNorm = ri / radSegs  // 0-1 はガマット境界に対する比率
      const radius = chromaNorm * maxR
      // 密度グリッドは maxChroma (画像内最大) で正規化されている
      // chromaNorm をガマット基準 → 画像基準にリマップ
      const actualChroma = chromaNorm * gamutC
      const densityChromaNorm = maxChroma > 0 ? actualChroma / maxChroma : 0
      // データ範囲外（actualChroma > maxChroma）では密度 0
      const density = densityChromaNorm > 1.0
        ? 0
        : sampleDensity(densityGrid, hueBinCount, chromaBinCount, hueNorm, densityChromaNorm)
      const height = density * HEIGHT_SCALE

      const vi = ai * (radSegs + 1) + ri
      const vi3 = vi * 3
      positions[vi3] = radius * Math.cos(theta)
      positions[vi3 + 1] = height
      positions[vi3 + 2] = radius * Math.sin(theta)

      // 色: 常にうっすらカラーホイールの色を敷き、密度が高い部分はより鮮やかに
      const baseColor = sampleColor(wheelColors, hueBinCount, chromaBinCount, hueNorm, densityChromaNorm)
      const color = new Color()
      const bc = new Color()
      bc.setRGB(baseColor.r / 255, baseColor.g / 255, baseColor.b / 255, SRGBColorSpace)
      // 明度帯に応じてスケーリング
      const hsl = { h: 0, s: 0, l: 0 }
      bc.getHSL(hsl)
      hsl.l = Math.min(1, hsl.l * lScale)
      bc.setHSL(hsl.h, hsl.s, hsl.l)
      // density > 0 なら即座にがっつり色を塗る
      const blend = density > 0.001 ? 1.0 : chromaNorm * 0.25
      color.copy(baseGround).lerp(bc, blend)

      colors[vi3] = color.r
      colors[vi3 + 1] = color.g
      colors[vi3 + 2] = color.b
    }
  }

  const indices = buildDiscIndices(angSegs, radSegs)
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()

  disposeObj(terrainMesh.value)
  terrainMesh.value = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }))

  // ワイヤーフレーム
  disposeObj(terrainWire.value)
  const wireGeo = new WireframeGeometry(geo)
  terrainWire.value = new LineSegments(wireGeo, new LineBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.15,
  }))
}

// === 白い地面ディスク ===
function buildGround() {
  const { gamutMaxChroma } = props.data
  const globalMaxC = Math.max(...gamutMaxChroma)
  const angSegs = 72
  const radSegs = 24
  const vertexCount = (angSegs + 1) * (radSegs + 1)
  const positions = new Float32Array(vertexCount * 3)

  for (let ai = 0; ai <= angSegs; ai++) {
    const hueNorm = ai / angSegs
    const theta = hueNorm * Math.PI * 2
    const maxR = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm)
    for (let ri = 0; ri <= radSegs; ri++) {
      const radius = (ri / radSegs) * maxR
      const vi = ai * (radSegs + 1) + ri
      const vi3 = vi * 3
      positions[vi3] = radius * Math.cos(theta)
      positions[vi3 + 1] = -0.005
      positions[vi3 + 2] = radius * Math.sin(theta)
    }
  }

  const indices = buildDiscIndices(angSegs, radSegs)
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)

  disposeObj(groundMesh.value)
  const groundColor = bandBaseColor()
  groundMesh.value = new Mesh(geo, new MeshBasicMaterial({
    color: groundColor, side: DoubleSide,
  }))
}

// === 蜘蛛の巣グリッド（色付き） ===
function buildGrid() {
  const { hueBinCount, chromaBinCount, wheelColors, gamutMaxChroma } = props.data
  const globalMaxC = Math.max(...gamutMaxChroma)
  const linePositions: number[] = []
  const lineColors: number[] = []

  const CONCENTRIC_CIRCLES = 8
  const RADIAL_LINES = 24

  // 同心円（chroma レベル）— ガマット形状に合わせる
  const circleSegs = 72
  for (let ci = 1; ci <= CONCENTRIC_CIRCLES; ci++) {
    const chromaNorm = ci / CONCENTRIC_CIRCLES
    for (let si = 0; si < circleSegs; si++) {
      const hueNorm1 = si / circleSegs
      const hueNorm2 = (si + 1) / circleSegs
      const theta1 = hueNorm1 * Math.PI * 2
      const theta2 = hueNorm2 * Math.PI * 2
      const r1 = chromaNorm * gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm1)
      const r2 = chromaNorm * gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm2)

      linePositions.push(
        r1 * Math.cos(theta1), -0.003, r1 * Math.sin(theta1),
        r2 * Math.cos(theta2), -0.003, r2 * Math.sin(theta2),
      )

      const c1 = sampleColor(wheelColors, hueBinCount, chromaBinCount, hueNorm1, chromaNorm)
      const c2 = sampleColor(wheelColors, hueBinCount, chromaBinCount, hueNorm2, chromaNorm)
      const col1 = new Color()
      const col2 = new Color()
      col1.setRGB(c1.r / 255, c1.g / 255, c1.b / 255, SRGBColorSpace)
      col2.setRGB(c2.r / 255, c2.g / 255, c2.b / 255, SRGBColorSpace)
      lineColors.push(col1.r, col1.g, col1.b, col2.r, col2.g, col2.b)
    }
  }

  // 放射線（hue 方向）— 外縁はガマット形状
  for (let hi = 0; hi < RADIAL_LINES; hi++) {
    const hueNorm = hi / RADIAL_LINES
    const theta = hueNorm * Math.PI * 2
    const outerR = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm)

    linePositions.push(
      0, -0.003, 0,
      outerR * Math.cos(theta), -0.003, outerR * Math.sin(theta),
    )

    const cInner = sampleColor(wheelColors, hueBinCount, chromaBinCount, hueNorm, 0.1)
    const cOuter = sampleColor(wheelColors, hueBinCount, chromaBinCount, hueNorm, 0.9)
    const col1 = new Color()
    const col2 = new Color()
    col1.setRGB(cInner.r / 255, cInner.g / 255, cInner.b / 255, SRGBColorSpace)
    col2.setRGB(cOuter.r / 255, cOuter.g / 255, cOuter.b / 255, SRGBColorSpace)
    lineColors.push(col1.r, col1.g, col1.b, col2.r, col2.g, col2.b)
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(linePositions, 3))
  geo.setAttribute('color', new Float32BufferAttribute(lineColors, 3))

  disposeObj(gridLines.value)
  gridLines.value = new LineSegments(geo, new LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.7,
  }))
}

// === 外周色相環リング（土星リング風） ===
function buildHueRing() {
  const { hueBinCount, gamutMaxChroma } = props.data
  const globalMaxC = Math.max(...gamutMaxChroma)
  const segs = 120
  const vertexCount = (segs + 1) * 2
  const positions = new Float32Array(vertexCount * 3)
  const colors = new Float32Array(vertexCount * 3)

  for (let i = 0; i <= segs; i++) {
    const hueNorm = i / segs
    const theta = hueNorm * Math.PI * 2

    // 高彩度の色相環色
    const sectorIdx = Math.floor(hueNorm * hueBinCount) % hueBinCount
    const rgb = props.data.ringColors[sectorIdx] ?? { r: 128, g: 128, b: 128 }
    const color = new Color()
    color.setRGB(rgb.r / 255, rgb.g / 255, rgb.b / 255, SRGBColorSpace)

    const baseR = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm)
    const ringInner = baseR + RING_OFFSET
    const ringOuter = ringInner + RING_WIDTH

    // inner vertex
    const vi = i * 2
    positions[vi * 3] = ringInner * Math.cos(theta)
    positions[vi * 3 + 1] = 0
    positions[vi * 3 + 2] = ringInner * Math.sin(theta)
    colors[vi * 3] = color.r
    colors[vi * 3 + 1] = color.g
    colors[vi * 3 + 2] = color.b

    // outer vertex
    const vo = vi + 1
    positions[vo * 3] = ringOuter * Math.cos(theta)
    positions[vo * 3 + 1] = 0
    positions[vo * 3 + 2] = ringOuter * Math.sin(theta)
    colors[vo * 3] = color.r
    colors[vo * 3 + 1] = color.g
    colors[vo * 3 + 2] = color.b
  }

  // 三角形: strip
  const indexArr: number[] = []
  for (let i = 0; i < segs; i++) {
    const a = i * 2
    const b = a + 1
    const c = a + 2
    const d = a + 3
    indexArr.push(a, c, b, b, c, d)
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geo.setIndex(indexArr)
  geo.computeVertexNormals()

  disposeObj(hueRingMesh.value)
  hueRingMesh.value = new Mesh(geo, new MeshBasicMaterial({
    vertexColors: true, side: DoubleSide,
  }))
}

// === ユーティリティ ===
function buildDiscIndices(angSegs: number, radSegs: number): number[] {
  const indices: number[] = []
  for (let ai = 0; ai < angSegs; ai++) {
    for (let ri = 0; ri < radSegs; ri++) {
      const a = ai * (radSegs + 1) + ri
      const b = a + 1
      const c = (ai + 1) * (radSegs + 1) + ri
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  return indices
}

function disposeObj(obj: Mesh | LineSegments | null) {
  if (!obj) return
  obj.geometry.dispose()
  if ('dispose' in obj.material) (obj.material as MeshBasicMaterial).dispose()
}

// === 再構築 ===
watch(
  [() => props.data, () => props.activeBand],
  () => {
    buildTerrain()
    buildGround()
    buildGrid()
    buildHueRing()
  },
  { immediate: true },
)

const isMounted = ref(false)
onMounted(() => { isMounted.value = true })

onScopeDispose(() => {
  disposeObj(terrainMesh.value)
  disposeObj(terrainWire.value)
  disposeObj(groundMesh.value)
  disposeObj(gridLines.value)
  disposeObj(hueRingMesh.value)
})
</script>
