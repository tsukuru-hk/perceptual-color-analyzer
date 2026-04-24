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

      <TresGroup :position-y="SCENE_Y_OFFSET" :scale-y="animScaleY">
        <!-- 白い地面ディスク -->
        <primitive v-if="groundMesh" :object="groundMesh" />

        <!-- 蜘蛛の巣グリッド（色付き同心円 + 放射線） -->
        <primitive v-if="gridLines" :object="gridLines" />

        <!-- 地形メッシュ -->
        <primitive :object="terrainMesh" />

        <!-- 外周の色相環リング（土星リング風） -->
        <primitive v-if="hueRingMesh" :object="hueRingMesh" />
      </TresGroup>

      <!-- アニメーションなしのグループ -->
      <TresGroup :position-y="SCENE_Y_OFFSET">
        <!-- 地形ワイヤーフレーム -->
        <primitive v-if="terrainWire" :object="terrainWire" />

        <!-- リファレンスグリッド（等彩度線 + 等高線 + ドット） -->
        <primitive v-if="refGrid" :object="refGrid" />

        <!-- 中心軸線 -->
        <primitive v-if="centerAxis" :object="centerAxis" />
      </TresGroup>
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

<script lang="ts">
/**
 * アニメーション済みのデータを追跡するグローバル WeakSet。
 * 同じ HueAnalysisResult オブジェクトが再マウントされた際に
 * 二度目以降はアニメーションをスキップするためにモジュールレベルで保持する。
 */
const animatedTerrainData = new WeakSet<object>()
</script>

<script setup lang="ts">
import { computed, watch, shallowRef, ref, onMounted, onScopeDispose } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  LineSegments,
  LineBasicMaterial,
  SphereGeometry,
  Matrix4,
  WireframeGeometry,
  DoubleSide,
  SRGBColorSpace,
  Color,
  PerspectiveCamera,
  Vector3,
} from 'three'
import type { HueAnalysisResult, PolarDensityCell } from '@/types/hueAnalysis'
import type { TerrainWorkerRequest, TerrainWorkerResponse } from '@/infrastructure/terrainGeometryWorker'

const props = defineProps<{
  data: HueAnalysisResult
  activeBand: 'all' | 'dark' | 'mid' | 'light'
  height?: number
  logScale?: boolean
}>()

// === カメラ（永続オブジェクト — バンド切替時にリセットされない） ===
const INITIAL_CAM_POS = new Vector3(4, 1.5, 4)
const INITIAL_CAM_TARGET = new Vector3(0, 0, 0)
/** シーン全体の Y オフセット（地平面を画面下寄りにする） */
const SCENE_Y_OFFSET = -0.5

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

// === 明度帯スケーリング済み Linear RGB LUT ===
// wheelColors (sRGB 0-255) を、現在の activeBand に応じた HSL 明度スケーリング済み Linear RGB に変換。
// メインスレッドの update* 系関数で毎頂点 getHSL/setHSL する代わりに LUT 参照のみで済む。
const scaledWheelColorsLUT = computed<Float32Array>(() => {
  const wc = props.data.wheelColors
  const lScale = bandLightnessScale()
  const lut = new Float32Array(wc.length * 3)
  for (let i = 0; i < wc.length; i++) {
    const c = wc[i]!
    _tmpBC.setRGB(c.r / 255, c.g / 255, c.b / 255, SRGBColorSpace)
    _tmpBC.getHSL(_tmpHSL)
    _tmpHSL.l = Math.min(1, _tmpHSL.l * lScale)
    _tmpBC.setHSL(_tmpHSL.h, _tmpHSL.s, _tmpHSL.l)
    lut[i * 3] = _tmpBC.r
    lut[i * 3 + 1] = _tmpBC.g
    lut[i * 3 + 2] = _tmpBC.b
  }
  return lut
})

/** LUT から Linear RGB をバイリニア補間サンプリング */
function sampleScaledColor(
  lut: Float32Array,
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
  const i00 = (h0 * chromaBins + c0) * 3
  const i10 = (h1 * chromaBins + c0) * 3
  const i01 = (h0 * chromaBins + c1) * 3
  const i11 = (h1 * chromaBins + c1) * 3
  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t
  return {
    r: lerp(lerp(lut[i00]!, lut[i10]!, ht), lerp(lut[i01]!, lut[i11]!, ht), ct),
    g: lerp(lerp(lut[i00 + 1]!, lut[i10 + 1]!, ht), lerp(lut[i01 + 1]!, lut[i11 + 1]!, ht), ct),
    b: lerp(lerp(lut[i00 + 2]!, lut[i10 + 2]!, ht), lerp(lut[i01 + 2]!, lut[i11 + 2]!, ht), ct),
  }
}

/** ringColors を明度帯スケーリング済み Linear RGB に変換した LUT */
const scaledRingColorsLUT = computed<Float32Array>(() => {
  const rc = props.data.ringColors
  const lScale = bandLightnessScale()
  const lut = new Float32Array(rc.length * 3)
  for (let i = 0; i < rc.length; i++) {
    const c = rc[i]!
    _tmpBC.setRGB(c.r / 255, c.g / 255, c.b / 255, SRGBColorSpace)
    _tmpBC.getHSL(_tmpHSL)
    _tmpHSL.l = Math.min(1, _tmpHSL.l * lScale)
    _tmpBC.setHSL(_tmpHSL.h, _tmpHSL.s, _tmpHSL.l)
    lut[i * 3] = _tmpBC.r
    lut[i * 3 + 1] = _tmpBC.g
    lut[i * 3 + 2] = _tmpBC.b
  }
  return lut
})

// === Worker セットアップ ===
let terrainWorker: Worker | null = null
let workerRequestId = 0
const workerCallbacks = new Map<number, (resp: TerrainWorkerResponse) => void>()

function getTerrainWorker(): Worker {
  if (!terrainWorker) {
    terrainWorker = new Worker(
      new URL('@/infrastructure/terrainGeometryWorker.ts', import.meta.url),
      { type: 'module' },
    )
    terrainWorker.onmessage = (e: MessageEvent<TerrainWorkerResponse>) => {
      const cb = workerCallbacks.get(e.data.id)
      if (cb) {
        workerCallbacks.delete(e.data.id)
        cb(e.data)
      }
    }
  }
  return terrainWorker
}

/** wheelColors を flat な Float32Array (r,g,b,...) に変換 */
function flattenWheelColors(): Float32Array {
  const wc = props.data.wheelColors
  const arr = new Float32Array(wc.length * 3)
  for (let i = 0; i < wc.length; i++) {
    const c = wc[i]!
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  return arr
}

/** Worker リクエスト用の共通パラメータを構築 */
function buildWorkerParams(type: 'terrain' | 'refGrid'): TerrainWorkerRequest {
  const id = ++workerRequestId
  const cells = activeDensityCells.value
  return {
    id,
    type,
    hueBinCount: props.data.hueBinCount,
    chromaBinCount: props.data.chromaBinCount,
    wheelColors: flattenWheelColors(),
    gamutMaxChroma: props.data.gamutMaxChroma,
    maxChroma: props.data.maxChroma,
    densityCells: cells.map(c => ({ hueBin: c.hueBin, chromaBin: c.chromaBin, density: c.density })),
    logScale: !!props.logScale,
    activeBand: props.activeBand,
    angularSegments: ANGULAR_SEGMENTS,
    radialSegments: RADIAL_SEGMENTS,
    terrainRadius: TERRAIN_RADIUS,
    heightScale: HEIGHT_SCALE,
  }
}

/** Worker で terrain を構築し、結果を適用 */
function buildTerrainAsync(): Promise<void> {
  return new Promise((resolve) => {
    const req = buildWorkerParams('terrain')
    workerCallbacks.set(req.id, (resp) => {
      applyTerrainBuffers(resp.positions, resp.colors)
      resolve()
    })
    getTerrainWorker().postMessage(req)
  })
}

/** Worker で refGrid を構築し、結果を適用 */
function buildRefGridAsync(): Promise<void> {
  return new Promise((resolve) => {
    const req = buildWorkerParams('refGrid')
    workerCallbacks.set(req.id, (resp) => {
      applyRefGridBuffers(resp.positions, resp.colors, resp.dotPositions!, resp.dotColors!)
      resolve()
    })
    getTerrainWorker().postMessage(req)
  })
}

/** Worker から受け取った terrain バッファを Mesh に適用 */
function applyTerrainBuffers(positions: Float32Array, colors: Float32Array) {
  const angSegs = ANGULAR_SEGMENTS
  const radSegs = RADIAL_SEGMENTS
  const indices = buildDiscIndices(angSegs, radSegs)
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()

  disposeObj(terrainMesh.value)
  terrainMesh.value = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }))

  disposeObj(terrainWire.value)
  const wireGeo = new WireframeGeometry(geo)
  terrainWire.value = new LineSegments(wireGeo, new LineBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.15,
  }))
}

/** Worker から受け取った refGrid バッファを Group に適用 */
function applyRefGridBuffers(linePos: Float32Array, lineCol: Float32Array, dotPos: Float32Array, dotCol: Float32Array) {
  const DOT_RADIUS = 0.008
  const root = new Group()

  if (linePos.length > 0) {
    const lineGeo = new BufferGeometry()
    lineGeo.setAttribute('position', new Float32BufferAttribute(linePos, 3))
    lineGeo.setAttribute('color', new Float32BufferAttribute(lineCol, 3))
    root.add(new LineSegments(lineGeo, new LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.6,
    })))
  }

  const dotCount = dotPos.length / 3
  if (dotCount > 0) {
    const dotMat = new MeshBasicMaterial({ transparent: true, opacity: 0.7 })
    const im = new InstancedMesh(dotSphereGeo, dotMat, dotCount)
    const m = new Matrix4()
    const p = new Vector3()

    for (let i = 0; i < dotCount; i++) {
      const i3 = i * 3
      p.set(dotPos[i3]!, dotPos[i3 + 1]!, dotPos[i3 + 2]!)
      m.makeScale(DOT_RADIUS, DOT_RADIUS, DOT_RADIUS)
      m.setPosition(p)
      im.setMatrixAt(i, m)
      _tmpColor.setRGB(dotCol[i3]!, dotCol[i3 + 1]!, dotCol[i3 + 2]!)
      im.setColorAt(i, _tmpColor)
    }
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    root.add(im)
  }

  disposeRefGrid(refGrid.value)
  refGrid.value = root
}

// === refs ===
const terrainMesh = shallowRef<Mesh | null>(null)
const terrainWire = shallowRef<LineSegments | null>(null)
const groundMesh = shallowRef<Mesh | null>(null)
const gridLines = shallowRef<LineSegments | null>(null)
const hueRingMesh = shallowRef<Mesh | null>(null)
const centerAxis = shallowRef<LineSegments | null>(null)
const refGrid = shallowRef<Group | null>(null)
const dotSphereGeo = new SphereGeometry(1, 6, 4)

// === 登場アニメーション（山が聳え立つ演出） ===
const RISE_DURATION = 1.0 // 秒
const animScaleY = ref(1)
let animRafId = 0
let animStartTime = -1

/** ease-out-back: 少しオーバーシュートしてから着地 */
function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function startRiseAnimation() {
  animScaleY.value = 0
  animStartTime = -1
  cancelAnimationFrame(animRafId)

  function tick(now: number) {
    if (animStartTime < 0) animStartTime = now
    const elapsed = (now - animStartTime) / 1000
    if (elapsed >= RISE_DURATION) {
      animScaleY.value = 1
      animatedTerrainData.add(props.data)
      return
    }
    const t = elapsed / RISE_DURATION
    animScaleY.value = easeOutBack(t)
    animRafId = requestAnimationFrame(tick)
  }
  animRafId = requestAnimationFrame(tick)
}

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

/** 明度帯に応じた地面の基底色（新しい Color を返す — buildTerrain で baseGround として保持される） */
function bandBaseColor(): Color {
  switch (props.activeBand) {
    case 'dark': return new Color().setRGB(0.25, 0.25, 0.28, SRGBColorSpace)
    case 'mid': return new Color().setRGB(0.6, 0.6, 0.62, SRGBColorSpace)
    case 'light': return new Color().setRGB(0.95, 0.95, 0.95, SRGBColorSpace)
    default: return new Color().setRGB(0.95, 0.95, 0.95, SRGBColorSpace)
  }
}

// 再利用用の一時オブジェクト（アロケーション削減）
const _tmpColor = new Color()
const _tmpBC = new Color()
const _tmpHSL = { h: 0, s: 0, l: 0 }

/** 地形の頂点座標・カラー配列を計算する（LUT 使用版） */
function computeTerrainBuffers(positions: Float32Array, colors: Float32Array) {
  const { hueBinCount, chromaBinCount, gamutMaxChroma, maxChroma } = props.data
  const densityGrid = buildDensityGrid(activeDensityCells.value, hueBinCount, chromaBinCount)
  const globalMaxC = Math.max(...gamutMaxChroma)
  const baseGround = bandBaseColor()
  const lut = scaledWheelColorsLUT.value

  const angSegs = ANGULAR_SEGMENTS
  const radSegs = RADIAL_SEGMENTS

  for (let ai = 0; ai <= angSegs; ai++) {
    const hueNorm = ai / angSegs
    const theta = hueNorm * Math.PI * 2
    const cosTheta = Math.cos(theta)
    const sinTheta = Math.sin(theta)
    const maxR = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm)
    const gamutC = sampleGamutMaxChroma(gamutMaxChroma, hueNorm)
    for (let ri = 0; ri <= radSegs; ri++) {
      const chromaNorm = ri / radSegs
      const radius = chromaNorm * maxR
      const actualChroma = chromaNorm * gamutC
      const densityChromaNorm = maxChroma > 0 ? actualChroma / maxChroma : 0
      const rawDensity = densityChromaNorm > 1.0
        ? 0
        : sampleDensity(densityGrid, hueBinCount, chromaBinCount, hueNorm, densityChromaNorm)
      const density = props.logScale && rawDensity > 0
        ? Math.log1p(rawDensity * 100) / Math.log1p(100)
        : rawDensity
      const height = density * HEIGHT_SCALE

      const vi = ai * (radSegs + 1) + ri
      const vi3 = vi * 3
      positions[vi3] = radius * cosTheta
      positions[vi3 + 1] = height
      positions[vi3 + 2] = radius * sinTheta

      // LUT から HSL 変換済み Linear RGB を直接取得（getHSL/setHSL 不要）
      const sc = sampleScaledColor(lut, hueBinCount, chromaBinCount, hueNorm, densityChromaNorm)
      const blend = density > 0.001 ? 1.0 : chromaNorm * 0.25
      colors[vi3] = baseGround.r + (sc.r - baseGround.r) * blend
      colors[vi3 + 1] = baseGround.g + (sc.g - baseGround.g) * blend
      colors[vi3 + 2] = baseGround.b + (sc.b - baseGround.b) * blend
    }
  }
}

function buildTerrain() {
  const angSegs = ANGULAR_SEGMENTS
  const radSegs = RADIAL_SEGMENTS
  const vertexCount = (angSegs + 1) * (radSegs + 1)
  const positions = new Float32Array(vertexCount * 3)
  const colors = new Float32Array(vertexCount * 3)

  computeTerrainBuffers(positions, colors)

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

/** 既存ジオメトリの position/color バッファを差分更新（バンド切替用） */
function updateTerrainBuffers() {
  const mesh = terrainMesh.value
  if (!mesh) { buildTerrain(); return }

  const geo = mesh.geometry
  const posAttr = geo.getAttribute('position')
  const colorAttr = geo.getAttribute('color')
  if (!posAttr || !colorAttr) { buildTerrain(); return }

  const positions = posAttr.array as Float32Array
  const colors = colorAttr.array as Float32Array
  computeTerrainBuffers(positions, colors)
  posAttr.needsUpdate = true
  colorAttr.needsUpdate = true
  geo.computeVertexNormals()

  // ワイヤーフレームも更新
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
      _tmpColor.setRGB(c1.r / 255, c1.g / 255, c1.b / 255, SRGBColorSpace)
      const r1c = _tmpColor.r, g1c = _tmpColor.g, b1c = _tmpColor.b
      _tmpColor.setRGB(c2.r / 255, c2.g / 255, c2.b / 255, SRGBColorSpace)
      lineColors.push(r1c, g1c, b1c, _tmpColor.r, _tmpColor.g, _tmpColor.b)
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
    _tmpColor.setRGB(cInner.r / 255, cInner.g / 255, cInner.b / 255, SRGBColorSpace)
    const ric = _tmpColor.r, gic = _tmpColor.g, bic = _tmpColor.b
    _tmpColor.setRGB(cOuter.r / 255, cOuter.g / 255, cOuter.b / 255, SRGBColorSpace)
    lineColors.push(ric, gic, bic, _tmpColor.r, _tmpColor.g, _tmpColor.b)
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

    // 高彩度の色相環色（明度帯に応じてスケーリング）
    const sectorIdx = Math.floor(hueNorm * hueBinCount) % hueBinCount
    const rgb = props.data.ringColors[sectorIdx] ?? { r: 128, g: 128, b: 128 }
    _tmpColor.setRGB(rgb.r / 255, rgb.g / 255, rgb.b / 255, SRGBColorSpace)
    _tmpColor.getHSL(_tmpHSL)
    _tmpHSL.l = Math.min(1, _tmpHSL.l * bandLightnessScale())
    _tmpColor.setHSL(_tmpHSL.h, _tmpHSL.s, _tmpHSL.l)

    const baseR = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm)
    const ringInner = baseR + RING_OFFSET
    const ringOuter = ringInner + RING_WIDTH

    // inner vertex
    const vi = i * 2
    positions[vi * 3] = ringInner * Math.cos(theta)
    positions[vi * 3 + 1] = 0
    positions[vi * 3 + 2] = ringInner * Math.sin(theta)
    colors[vi * 3] = _tmpColor.r
    colors[vi * 3 + 1] = _tmpColor.g
    colors[vi * 3 + 2] = _tmpColor.b

    // outer vertex
    const vo = vi + 1
    positions[vo * 3] = ringOuter * Math.cos(theta)
    positions[vo * 3 + 1] = 0
    positions[vo * 3 + 2] = ringOuter * Math.sin(theta)
    colors[vo * 3] = _tmpColor.r
    colors[vo * 3 + 1] = _tmpColor.g
    colors[vo * 3 + 2] = _tmpColor.b
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

// === リファレンスグリッド（等彩度線 + 等高線 + ドット） ===
function buildRefGrid() {
  const { hueBinCount, chromaBinCount, wheelColors, gamutMaxChroma, maxChroma } = props.data
  const densityGrid = buildDensityGrid(activeDensityCells.value, hueBinCount, chromaBinCount)
  const globalMaxC = Math.max(...gamutMaxChroma)
  const lScale = bandLightnessScale()

  const root = new Group()
  const linePositions: number[] = []
  const lineColors: number[] = []
  const dotPositions: number[] = []  // x, y, z を flat に格納
  const dotColors: number[] = []     // r, g, b を flat に格納

  const CHROMA_RINGS = 6
  const HEIGHT_LEVELS = 4
  const RING_SEGS = 90
  const DOT_RADIUS = 0.008

  /** 指定 hueNorm / chromaNorm での地形高さを取得 */
  function terrainHeightAt(hueNorm: number, chromaNorm: number): number {
    const gamutC = sampleGamutMaxChroma(gamutMaxChroma, hueNorm)
    const actualChroma = chromaNorm * gamutC
    const densityChromaNorm = maxChroma > 0 ? actualChroma / maxChroma : 0
    if (densityChromaNorm > 1.0) return 0
    const d = sampleDensity(densityGrid, hueBinCount, chromaBinCount, hueNorm, densityChromaNorm)
    const scaled = props.logScale && d > 0 ? Math.log1p(d * 100) / Math.log1p(100) : d
    return scaled * HEIGHT_SCALE
  }

  /** hueNorm / chromaNorm での色を _tmpColor にセット（バンド明度反映） */
  function colorAt(hueNorm: number, chromaNorm: number): void {
    const gamutC = sampleGamutMaxChroma(gamutMaxChroma, hueNorm)
    const actualChroma = chromaNorm * gamutC
    const densityChromaNorm = maxChroma > 0 ? actualChroma / maxChroma : 0
    const base = sampleColor(wheelColors, hueBinCount, chromaBinCount, hueNorm, Math.min(1, densityChromaNorm))
    _tmpColor.setRGB(base.r / 255, base.g / 255, base.b / 255, SRGBColorSpace)
    _tmpColor.getHSL(_tmpHSL)
    _tmpHSL.l = Math.min(1, _tmpHSL.l * lScale)
    _tmpColor.setHSL(_tmpHSL.h, _tmpHSL.s, _tmpHSL.l)
  }

  // --- 等彩度リング（地形表面に沿って走る） ---
  for (let ci = 1; ci <= CHROMA_RINGS; ci++) {
    const chromaNorm = ci / (CHROMA_RINGS + 1)
    for (let si = 0; si < RING_SEGS; si++) {
      const hueNorm1 = si / RING_SEGS
      const hueNorm2 = (si + 1) / RING_SEGS
      const theta1 = hueNorm1 * Math.PI * 2
      const theta2 = hueNorm2 * Math.PI * 2

      const maxR1 = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm1)
      const maxR2 = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm2)
      const r1 = chromaNorm * maxR1
      const r2 = chromaNorm * maxR2

      const h1 = terrainHeightAt(hueNorm1, chromaNorm) + 0.005
      const h2 = terrainHeightAt(hueNorm2, chromaNorm) + 0.005

      const x1 = r1 * Math.cos(theta1), z1 = r1 * Math.sin(theta1)
      const x2 = r2 * Math.cos(theta2), z2 = r2 * Math.sin(theta2)

      colorAt(hueNorm1, chromaNorm)
      const r1c = _tmpColor.r, g1c = _tmpColor.g, b1c = _tmpColor.b
      colorAt(hueNorm2, chromaNorm)

      linePositions.push(x1, h1, z1, x2, h2, z2)
      lineColors.push(r1c, g1c, b1c, _tmpColor.r, _tmpColor.g, _tmpColor.b)

      if (si % 10 === 0) {
        dotPositions.push(x1, h1, z1)
        dotColors.push(r1c, g1c, b1c)
      }
    }
  }

  // --- 水平リング（空間に浮かぶ高さ目盛り） ---
  const HORIZ_RING_SEGS = 90
  for (let hi = 1; hi <= HEIGHT_LEVELS; hi++) {
    const y = (hi / (HEIGHT_LEVELS + 1)) * HEIGHT_SCALE
    for (let si = 0; si < HORIZ_RING_SEGS; si++) {
      const hueNorm1 = si / HORIZ_RING_SEGS
      const hueNorm2 = (si + 1) / HORIZ_RING_SEGS
      const theta1 = hueNorm1 * Math.PI * 2
      const theta2 = hueNorm2 * Math.PI * 2
      const r1 = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm1)
      const r2 = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm2)

      const x1 = r1 * Math.cos(theta1), z1 = r1 * Math.sin(theta1)
      const x2 = r2 * Math.cos(theta2), z2 = r2 * Math.sin(theta2)

      colorAt(hueNorm1, 0.9)
      const r1c = _tmpColor.r, g1c = _tmpColor.g, b1c = _tmpColor.b
      colorAt(hueNorm2, 0.9)

      linePositions.push(x1, y, z1, x2, y, z2)
      lineColors.push(r1c, g1c, b1c, _tmpColor.r, _tmpColor.g, _tmpColor.b)

      if (si % 10 === 0) {
        dotPositions.push(x1, y, z1)
        dotColors.push(r1c, g1c, b1c)
      }
    }
  }

  // --- 垂直リブ（地面から最大高さまで、一定間隔の色相角で立てる） ---
  const VERT_RIB_COUNT = 12
  const VERT_RIB_SEGS = 8
  for (let ri = 0; ri < VERT_RIB_COUNT; ri++) {
    const hueNorm = ri / VERT_RIB_COUNT
    const theta = hueNorm * Math.PI * 2
    const r = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm)
    const x = r * Math.cos(theta)
    const z = r * Math.sin(theta)
    colorAt(hueNorm, 0.9)
    const rc = _tmpColor.r, gc = _tmpColor.g, bc = _tmpColor.b

    for (let vi = 0; vi < VERT_RIB_SEGS; vi++) {
      const y1 = (vi / VERT_RIB_SEGS) * HEIGHT_SCALE
      const y2 = ((vi + 1) / VERT_RIB_SEGS) * HEIGHT_SCALE

      linePositions.push(x, y1, z, x, y2, z)
      lineColors.push(rc, gc, bc, rc, gc, bc)
    }

    dotPositions.push(x, HEIGHT_SCALE, z)
    dotColors.push(rc, gc, bc)
  }

  // --- ワイヤーフレームライン ---
  if (linePositions.length > 0) {
    const lineGeo = new BufferGeometry()
    lineGeo.setAttribute('position', new Float32BufferAttribute(linePositions, 3))
    lineGeo.setAttribute('color', new Float32BufferAttribute(lineColors, 3))
    root.add(new LineSegments(lineGeo, new LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.6,
    })))
  }

  // --- ドット（InstancedMesh） ---
  const dotCount = dotPositions.length / 3
  if (dotCount > 0) {
    const dotMat = new MeshBasicMaterial({ transparent: true, opacity: 0.7 })
    const im = new InstancedMesh(dotSphereGeo, dotMat, dotCount)
    const m = new Matrix4()
    const p = new Vector3()

    for (let i = 0; i < dotCount; i++) {
      const i3 = i * 3
      p.set(dotPositions[i3]!, dotPositions[i3 + 1]!, dotPositions[i3 + 2]!)
      m.makeScale(DOT_RADIUS, DOT_RADIUS, DOT_RADIUS)
      m.setPosition(p)
      im.setMatrixAt(i, m)
      _tmpColor.setRGB(dotColors[i3]!, dotColors[i3 + 1]!, dotColors[i3 + 2]!)
      im.setColorAt(i, _tmpColor)
    }
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    root.add(im)
  }

  disposeRefGrid(refGrid.value)
  refGrid.value = root
}

function disposeRefGrid(g: Group | null) {
  if (!g) return
  g.traverse((obj) => {
    if ('geometry' in obj && obj.geometry) (obj as any).geometry.dispose()
    if ('material' in obj && obj.material) (obj as any).material.dispose()
    if (obj instanceof InstancedMesh) obj.dispose()
  })
}

// === 中心軸線 ===
function buildCenterAxis() {
  const axisHeight = HEIGHT_SCALE * 1.2
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute([
    0, -0.01, 0,
    0, axisHeight, 0,
  ], 3))

  disposeObj(centerAxis.value)
  centerAxis.value = new LineSegments(geo, new LineBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.5,
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

// === 軽量カラー更新（バンド切替時、形状再構築なし） ===
function updateGroundColor() {
  const mesh = groundMesh.value
  if (!mesh) return
  const mat = mesh.material as MeshBasicMaterial
  mat.color.copy(bandBaseColor())
  mat.needsUpdate = true
}

function updateGridColors() {
  const lines = gridLines.value
  if (!lines) return
  const { hueBinCount, chromaBinCount, wheelColors } = props.data
  const colorAttr = lines.geometry.getAttribute('color')
  if (!colorAttr) return
  const arr = colorAttr.array as Float32Array

  const CONCENTRIC_CIRCLES = 8
  const RADIAL_LINES = 24
  const circleSegs = 72

  let idx = 0
  for (let ci = 1; ci <= CONCENTRIC_CIRCLES; ci++) {
    const chromaNorm = ci / CONCENTRIC_CIRCLES
    for (let si = 0; si < circleSegs; si++) {
      const hueNorm1 = si / circleSegs
      const hueNorm2 = (si + 1) / circleSegs
      const c1 = sampleColor(wheelColors, hueBinCount, chromaBinCount, hueNorm1, chromaNorm)
      const c2 = sampleColor(wheelColors, hueBinCount, chromaBinCount, hueNorm2, chromaNorm)
      _tmpColor.setRGB(c1.r / 255, c1.g / 255, c1.b / 255, SRGBColorSpace)
      arr[idx++] = _tmpColor.r; arr[idx++] = _tmpColor.g; arr[idx++] = _tmpColor.b
      _tmpColor.setRGB(c2.r / 255, c2.g / 255, c2.b / 255, SRGBColorSpace)
      arr[idx++] = _tmpColor.r; arr[idx++] = _tmpColor.g; arr[idx++] = _tmpColor.b
    }
  }
  for (let hi = 0; hi < RADIAL_LINES; hi++) {
    const hueNorm = hi / RADIAL_LINES
    const cInner = sampleColor(wheelColors, hueBinCount, chromaBinCount, hueNorm, 0.1)
    const cOuter = sampleColor(wheelColors, hueBinCount, chromaBinCount, hueNorm, 0.9)
    _tmpColor.setRGB(cInner.r / 255, cInner.g / 255, cInner.b / 255, SRGBColorSpace)
    arr[idx++] = _tmpColor.r; arr[idx++] = _tmpColor.g; arr[idx++] = _tmpColor.b
    _tmpColor.setRGB(cOuter.r / 255, cOuter.g / 255, cOuter.b / 255, SRGBColorSpace)
    arr[idx++] = _tmpColor.r; arr[idx++] = _tmpColor.g; arr[idx++] = _tmpColor.b
  }
  colorAttr.needsUpdate = true
}

function updateHueRingColors() {
  const mesh = hueRingMesh.value
  if (!mesh) return
  const { hueBinCount } = props.data
  const colorAttr = mesh.geometry.getAttribute('color')
  if (!colorAttr) return
  const arr = colorAttr.array as Float32Array
  const segs = 120
  const lut = scaledRingColorsLUT.value

  for (let i = 0; i <= segs; i++) {
    const hueNorm = i / segs
    const sectorIdx = Math.floor(hueNorm * hueBinCount) % hueBinCount
    const i3 = sectorIdx * 3
    const r = lut[i3]!, g = lut[i3 + 1]!, b = lut[i3 + 2]!

    const vi = i * 2
    arr[vi * 3] = r; arr[vi * 3 + 1] = g; arr[vi * 3 + 2] = b
    const vo = vi + 1
    arr[vo * 3] = r; arr[vo * 3 + 1] = g; arr[vo * 3 + 2] = b
  }
  colorAttr.needsUpdate = true
}

// === 再構築 ===
/** 初回データ到着時、Canvas が未マウントならアニメーション予約 */
let pendingAnimation = false

const isMounted = ref(false)

// 段階的構築のキャンセル用
let deferredBuildId = 0

/** ジオメトリを段階的に構築する。terrain は Worker で非同期構築、残りは次フレーム以降に分割 */
function buildAllGeometry(newData: HueAnalysisResult) {
  // 前回の遅延構築をキャンセル
  const buildId = ++deferredBuildId

  // Phase 1: 地形メッシュを Worker で非同期構築（最重要 — Canvas 表示の条件）
  buildTerrainAsync().then(() => {
    if (buildId !== deferredBuildId) return

    // アニメーション設定
    if (!animatedTerrainData.has(newData)) {
      animScaleY.value = 0
      if (isMounted.value) {
        startRiseAnimation()
      } else {
        pendingAnimation = true
      }
    } else {
      animScaleY.value = 1
    }

    // Phase 2: 残りのジオメトリを次フレーム以降に分割構築
    requestAnimationFrame(() => {
      if (buildId !== deferredBuildId) return
      buildGround()
      buildGrid()
      buildCenterAxis()

      // Phase 3: refGrid も Worker で非同期構築
      buildRefGridAsync().then(() => {
        if (buildId !== deferredBuildId) return
        requestAnimationFrame(() => {
          if (buildId !== deferredBuildId) return
          buildHueRing()
        })
      })
    })
  })
}

// データ変更時: 全要素を段階的に再構築
watch(
  () => props.data,
  (newData) => {
    buildAllGeometry(newData)
  },
  { immediate: true },
)

// バンド / ログスケール変更時: 地形はバッファ差分更新、残りは軽量更新 + refGrid のみ再構築
watch(
  [() => props.activeBand, () => props.logScale],
  () => {
    // 地形: 既存ジオメトリの position/color バッファだけ書き換え
    updateTerrainBuffers()
    // 色だけ変わる → マテリアル色 / 頂点カラーのみ更新
    updateGroundColor()
    updateGridColors()
    updateHueRingColors()
    // refGrid は構造が可変なので Worker で非同期再構築
    buildRefGridAsync()
  },
)

onMounted(() => {
  isMounted.value = true
  if (pendingAnimation) {
    pendingAnimation = false
    // TresCanvas が WebGL コンテキストを初期化するまで数フレーム待つ
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        startRiseAnimation()
      })
    })
  }
})

onScopeDispose(() => {
  cancelAnimationFrame(animRafId)
  // Worker をクリーンアップ
  if (terrainWorker) {
    terrainWorker.terminate()
    terrainWorker = null
  }
  workerCallbacks.clear()
  disposeObj(terrainMesh.value)
  disposeObj(terrainWire.value)
  disposeObj(groundMesh.value)
  disposeObj(gridLines.value)
  disposeObj(hueRingMesh.value)
  disposeRefGrid(refGrid.value)
  disposeObj(centerAxis.value)
  dotSphereGeo.dispose()
})
</script>
