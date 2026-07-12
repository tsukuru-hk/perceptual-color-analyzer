<template>
  <div ref="rootRef" class="absolute inset-0">
    <!-- 操作パネル全体の表示/非表示トグル（常時表示） -->
    <GamutChromeToggle
      v-if="showToolbar"
      :model-value="showChrome"
      @update:model-value="$emit('update:showChrome', $event)"
    />

    <template v-if="showToolbar && showChrome">
      <GamutToolbar
        :mode="mode"
        :brush-point-count="brushData.count"
        @set-mode="$emit('set-mode', $event)"
        @clear-brush="$emit('clear-brush')"
      />
      <GamutViewControls
        :side-lock="sideLock"
        :auto-rotate-mode="autoRotateMode"
        @set-view="setViewPreset"
        @toggle-side="toggleSideLock"
        @set-auto-rotate="setAutoRotate"
      />
      <GamutWireframeSelector v-model="wireframeGamut" />
      <GamutGuideToggle v-model="showOrientation" />
      <GamutIsoHueToggle
        v-if="mode === 'bulk' && isoHueAvailable"
        :model-value="isoHueEnabled"
        @toggle="toggleIsoHue"
      />
    </template>
    <TresCanvas v-if="isMounted" :clear-color="'#a0a0a0'" :preserve-drawing-buffer="true">
      <TresPerspectiveCamera :position="initialCameraPosition" :fov="20" />
      <OrbitControls
        ref="controlsRef"
        :target="initialCameraTarget"
        :enable-damping="true"
        :damping-factor="0.08"
      />

      <TresGroup ref="spinGroupRef">
        <GamutPointCloud
          v-if="mode === 'bulk'"
          :data="pointCloudData"
          @animation-start="onAnimationStart"
          @animation-end="onAnimationEnd"
        />

        <GamutBrushCloud v-if="mode === 'brush'" :data="brushData" />

        <GamutReferenceGrid :wireframe-gamut="wireframeGamut" />

        <GamutOrientationGuide v-if="showOrientation" />
      </TresGroup>

    </TresCanvas>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import type { WireframeGamut } from '@/domain/colorSpace'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import type { Camera, Group, Vector3 } from 'three'
import type { GamutPointCloudData } from '@/types/analysis'
import type { GamutMode } from './composables/useGamutBrush'
import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  getSavedGamutCamera,
  saveGamutCamera,
} from './composables/gamutCameraState'
import type { GamutViewPreset } from './composables/gamutCameraState'
import GamutPointCloud from './GamutPointCloud.vue'
import GamutBrushCloud from './GamutBrushCloud.vue'
import GamutReferenceGrid from './GamutReferenceGrid.vue'
import GamutOrientationGuide from './GamutOrientationGuide.vue'
import GamutToolbar from './GamutToolbar.vue'
import GamutViewControls from './GamutViewControls.vue'
import GamutWireframeSelector from './GamutWireframeSelector.vue'
import GamutGuideToggle from './GamutGuideToggle.vue'
import GamutIsoHueToggle from './GamutIsoHueToggle.vue'
import GamutChromeToggle from './GamutChromeToggle.vue'
import { isoHueAvailable, isoHueEnabled, toggleIsoHue } from './composables/isoHuePlaneState'

/** スピンの総尺（秒） */
const SPIN_DURATION = 2.0
/** スピン角度（1 周） */
const SPIN_ANGLE = Math.PI * 2

const props = withDefaults(defineProps<{
  pointCloudData: GamutPointCloudData | null
  mode: GamutMode
  brushData: GamutPointCloudData
  /** ツールバー（自動/手動切替）を表示するか */
  showToolbar?: boolean
  /** 操作パネル（各種ボタン・トグル）の表示状態（v-model） */
  showChrome?: boolean
  /** 再マウントをまたいでカメラアングルを保持するか（画像タブ切替時の比較用） */
  persistCamera?: boolean
}>(), {
  showToolbar: true,
  showChrome: true,
  persistCamera: false,
})

defineEmits<{
  'set-mode': [mode: GamutMode]
  'clear-brush': []
  'update:showChrome': [value: boolean]
}>()

const wireframeGamut = ref<WireframeGamut>('srgb')

/** 見方ガイド（羅針盤オーバーレイ）の表示状態 */
const showOrientation = ref(false)

/** 真横ビュー固定（ON の間は仰角を水平に固定し、地軸まわりの回転だけ許可） */
const sideLock = ref(false)

const isMounted = ref(false)
onMounted(() => { isMounted.value = true })

const rootRef = ref<HTMLElement | null>(null)

/** PNG エクスポート用に WebGL の Canvas 要素を返す（未マウント時は null） */
function captureCanvas(): HTMLCanvasElement | null {
  return rootRef.value?.querySelector('canvas') ?? null
}

defineExpose({ captureCanvas })

const spinGroupRef = shallowRef<Group | null>(null)

/* ---------- camera ---------- */

/** OrbitControls のうちこのコンポーネントが触る部分 */
interface CameraControls {
  object: Camera
  target: Vector3
  update: () => void
  minPolarAngle: number
  maxPolarAngle: number
}

const controlsRef = shallowRef<{ instance?: CameraControls } | null>(null)

/**
 * 真横ビュー固定の ON/OFF。ON の間は仰角（極角）を水平（π/2）に固定するので、
 * ドラッグでは地軸まわりの回転（方位角）だけが変わる＝地球の自転のように回せる。
 */
function applySideLock(lock: boolean): void {
  const controls = controlsRef.value?.instance
  if (!controls) return
  stopSpin()
  if (lock) {
    const camera = controls.object
    const target = controls.target
    // 現在の方位角と距離を保ったまま水平（仰角0）へ移動する
    const dx = camera.position.x - target.x
    const dz = camera.position.z - target.z
    const dist = camera.position.distanceTo(target)
    const horiz = Math.hypot(dx, dz)
    if (horiz > 1e-6) {
      const s = dist / horiz
      camera.position.set(target.x + dx * s, target.y, target.z + dz * s)
    } else {
      camera.position.set(target.x + dist, target.y, target.z)
    }
    controls.minPolarAngle = Math.PI / 2
    controls.maxPolarAngle = Math.PI / 2
  } else {
    controls.minPolarAngle = 0
    controls.maxPolarAngle = Math.PI
  }
  controls.update()
}

function toggleSideLock(): void {
  sideLock.value = !sideLock.value
  applySideLock(sideLock.value)
}

// 前回保存したアングルがあれば復元した状態でマウントする（タブ切替対策）
const savedCamera = props.persistCamera ? getSavedGamutCamera() : null
const initialCameraPosition = savedCamera?.position ?? DEFAULT_CAMERA_POSITION
const initialCameraTarget = savedCamera?.target ?? DEFAULT_CAMERA_TARGET

function setViewPreset(view: GamutViewPreset): void {
  const controls = controlsRef.value?.instance
  if (!controls) return
  // スピン中に押されても即座に固定アングルになるよう回転を止める
  stopSpin()
  // プリセット視点は真横固定と両立しないので解除する
  if (sideLock.value) {
    sideLock.value = false
    controls.minPolarAngle = 0
    controls.maxPolarAngle = Math.PI
  }

  const camera = controls.object
  const target = controls.target
  if (view === 'default') {
    target.set(...DEFAULT_CAMERA_TARGET)
    camera.position.set(...DEFAULT_CAMERA_POSITION)
  } else {
    // ズーム（注視点までの距離）を保ったまま真上/真下へ移動する。
    // 上方向ベクトルと完全に一致すると OrbitControls が特異点になるため z をわずかにずらす。
    const distance = camera.position.distanceTo(target)
    const sign = view === 'top' ? 1 : -1
    camera.position.set(target.x, target.y + sign * distance, target.z + distance * 1e-3)
  }
  controls.update()
}

let spinning = false
let spinStartTime = -1
let rafId = 0

function stopSpin(): void {
  spinning = false
  const group = spinGroupRef.value
  // 自動回転中は現在の角度を維持する（0 にリセットしない）
  if (group && !isAutoRotating.value) group.rotation.y = 0
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
}

function onAnimationStart(): void {
  // bulk 以外に切り替わっていたら何もしない（多重 emit への防御）
  if (props.mode !== 'bulk') return
  // 自動回転中はイントロスピンを走らせない（回転が競合するため）
  if (isAutoRotating.value) return
  spinning = true
  spinStartTime = performance.now()
  if (!rafId) tick()
}

/* ---------- auto rotation ---------- */

/** 自動回転モード: 停止 / 低速（約30秒/回転）/ 高速（約10秒/回転） */
type AutoRotateMode = 'off' | 'slow' | 'fast'

/** 自動回転の角速度（rad/s）。地軸まわりに時計回り（上から見て負回転）。 */
const AUTO_ROTATE_SPEED_SLOW = -(Math.PI * 2) / 30 // 約30秒/回転
const AUTO_ROTATE_SPEED_FAST = -(Math.PI * 2) / 10 // 約10秒/回転

const autoRotateMode = ref<AutoRotateMode>('off')
const isAutoRotating = computed(() => autoRotateMode.value !== 'off')
let autoRafId = 0
let autoLastTime = -1

function autoRotateTick(): void {
  if (!isAutoRotating.value) {
    autoRafId = 0
    return
  }
  const now = performance.now()
  const group = spinGroupRef.value
  if (group && autoLastTime >= 0) {
    const dt = (now - autoLastTime) / 1000
    const speed = autoRotateMode.value === 'fast' ? AUTO_ROTATE_SPEED_FAST : AUTO_ROTATE_SPEED_SLOW
    group.rotation.y += speed * dt
  }
  autoLastTime = now
  autoRafId = requestAnimationFrame(autoRotateTick)
}

function setAutoRotate(mode: 'slow' | 'fast'): void {
  // 同じモードをもう一度押したら停止。違うモードなら速度切替（回転は継続）。
  if (autoRotateMode.value === mode) {
    autoRotateMode.value = 'off'
    if (autoRafId) {
      cancelAnimationFrame(autoRafId)
      autoRafId = 0
    }
    return
  }
  const wasOff = autoRotateMode.value === 'off'
  autoRotateMode.value = mode
  if (wasOff) {
    stopSpin() // イントロスピンが動いていれば止める（角度は維持）
    autoLastTime = -1
    if (!autoRafId) autoRotateTick()
  }
}

function onAnimationEnd(): void {
  stopSpin()
}

function tick(): void {
  if (!spinning) {
    rafId = 0
    return
  }

  const group = spinGroupRef.value
  if (!group) {
    // まだマウント待ち: 次フレームで再試行
    rafId = requestAnimationFrame(tick)
    return
  }

  const t = (performance.now() - spinStartTime) / 1000
  if (t < SPIN_DURATION) {
    const p = t / SPIN_DURATION
    const eased = 1 - Math.pow(1 - p, 3)
    group.rotation.y = SPIN_ANGLE * eased
    rafId = requestAnimationFrame(tick)
  } else {
    stopSpin()
  }
}

// モードが bulk 以外に切り替わった瞬間にスピンを止める。
// これにより、スピン中の mode 変更でブラシ側に回転が波及する問題を防ぐ。
watch(() => props.mode, (next) => {
  if (next !== 'bulk') stopSpin()
})

onBeforeUnmount(() => {
  // アンマウント時点のアングルを保存し、次回マウント時に復元する
  if (props.persistCamera) {
    const controls = controlsRef.value?.instance
    if (controls) saveGamutCamera(controls.object.position, controls.target)
  }
  if (rafId) cancelAnimationFrame(rafId)
  if (autoRafId) cancelAnimationFrame(autoRafId)
})
</script>
