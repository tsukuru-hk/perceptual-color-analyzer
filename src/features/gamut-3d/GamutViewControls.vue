<template>
  <div class="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
    <button
      v-for="preset in presets"
      :key="preset.value"
      type="button"
      class="inline-flex w-full items-center gap-1 rounded-lg border border-border bg-card/90 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground"
      :title="preset.title"
      @click="$emit('set-view', preset.value)"
    >
      <component :is="preset.icon" :size="13" />
      <span>{{ preset.label }}</span>
    </button>

    <!-- 真横から固定（トグル）: ON の間は地軸まわりの自転だけできる -->
    <button
      type="button"
      class="inline-flex w-full items-center gap-1 rounded-lg border px-2 py-1 text-xs shadow-sm backdrop-blur-sm transition-colors"
      :class="sideLock
        ? 'border-primary/60 bg-primary/15 text-foreground'
        : 'border-border bg-card/90 text-muted-foreground hover:text-foreground'"
      title="真横から固定して地軸まわりに回す（もう一度押すと解除）"
      :aria-pressed="sideLock"
      @click="$emit('toggle-side')"
    >
      <component :is="sideLock ? Check : MoveHorizontal" :size="13" />
      <span>真横から</span>
    </button>

    <!-- 自動回転（地軸まわりに時計回り）: 低速=約30秒/回転 / 高速=約10秒/回転 -->
    <button
      type="button"
      class="inline-flex w-full items-center gap-1 rounded-lg border px-2 py-1 text-xs shadow-sm backdrop-blur-sm transition-colors"
      :class="autoRotateMode === 'slow'
        ? 'border-primary/60 bg-primary/15 text-foreground'
        : 'border-border bg-card/90 text-muted-foreground hover:text-foreground'"
      title="地軸まわりにゆっくり自動回転・約30秒/回転（もう一度押すと停止）"
      :aria-pressed="autoRotateMode === 'slow'"
      @click="$emit('set-auto-rotate', 'slow')"
    >
      <RotateCw :size="13" :class="autoRotateMode === 'slow' ? 'animate-spin [animation-duration:3s]' : ''" />
      <span>低速回転</span>
    </button>
    <button
      type="button"
      class="inline-flex w-full items-center gap-1 rounded-lg border px-2 py-1 text-xs shadow-sm backdrop-blur-sm transition-colors"
      :class="autoRotateMode === 'fast'
        ? 'border-primary/60 bg-primary/15 text-foreground'
        : 'border-border bg-card/90 text-muted-foreground hover:text-foreground'"
      title="地軸まわりに速めに自動回転・約10秒/回転（もう一度押すと停止）"
      :aria-pressed="autoRotateMode === 'fast'"
      @click="$emit('set-auto-rotate', 'fast')"
    >
      <RotateCw :size="13" :class="autoRotateMode === 'fast' ? 'animate-spin [animation-duration:1s]' : ''" />
      <span>高速回転</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ArrowDownToDot, ArrowUpFromDot, Axis3d, MoveHorizontal, Check, RotateCw } from 'lucide-vue-next'
import type { GamutViewPreset } from './composables/gamutCameraState'

defineProps<{
  sideLock: boolean
  autoRotateMode: 'off' | 'slow' | 'fast'
}>()

defineEmits<{
  'set-view': [view: GamutViewPreset]
  'toggle-side': []
  'set-auto-rotate': [mode: 'slow' | 'fast']
}>()

const presets = [
  { value: 'top', label: '上から', title: '真上から見る（色相・彩度の平面）', icon: ArrowDownToDot },
  { value: 'bottom', label: '下から', title: '真下から見る', icon: ArrowUpFromDot },
  { value: 'default', label: '初期', title: '初期視点に戻す', icon: Axis3d },
] as const
</script>
