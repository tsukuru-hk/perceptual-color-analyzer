<template>
  <div class="absolute inset-0">
    <GamutToolbar
      :mode="mode"
      :brush-point-count="brushData.count"
      @set-mode="$emit('set-mode', $event)"
      @clear-brush="$emit('clear-brush')"
    />
    <TresCanvas v-if="isMounted" :clear-color="'#a0a0a0'">
      <TresPerspectiveCamera :position="[7, 5, 7]" :fov="20" />
      <OrbitControls
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

        <GamutReferenceGrid :color-space="colorSpace" />
      </TresGroup>

    </TresCanvas>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import type { Group } from 'three'
import type { GamutPointCloudData } from '@/types/analysis'
import type { ColorSpace } from '@/domain/colorSpace'
import type { GamutMode } from './composables/useGamutBrush'
import GamutPointCloud from './GamutPointCloud.vue'
import GamutBrushCloud from './GamutBrushCloud.vue'
import GamutReferenceGrid from './GamutReferenceGrid.vue'
import GamutToolbar from './GamutToolbar.vue'

/** スピンの総尺（秒） */
const SPIN_DURATION = 2.0
/** スピン角度（1 周） */
const SPIN_ANGLE = Math.PI * 2

const props = withDefaults(defineProps<{
  pointCloudData: GamutPointCloudData | null
  colorSpace?: ColorSpace
  mode: GamutMode
  brushData: GamutPointCloudData
}>(), {
  colorSpace: 'srgb',
})

defineEmits<{
  'set-mode': [mode: GamutMode]
  'clear-brush': []
}>()

const isMounted = ref(false)
onMounted(() => { isMounted.value = true })

const spinGroupRef = shallowRef<Group | null>(null)

let spinning = false
let spinStartTime = -1
let rafId = 0

function stopSpin(): void {
  spinning = false
  const group = spinGroupRef.value
  if (group) group.rotation.y = 0
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
}

function onAnimationStart(): void {
  // bulk 以外に切り替わっていたら何もしない（多重 emit への防御）
  if (props.mode !== 'bulk') return
  spinning = true
  spinStartTime = performance.now()
  if (!rafId) tick()
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
  if (rafId) cancelAnimationFrame(rafId)
})
</script>
