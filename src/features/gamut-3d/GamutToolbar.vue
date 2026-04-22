<template>
  <div class="absolute left-3 top-3 z-10 flex items-center gap-1.5">
    <SegmentedControl
      :options="options"
      :model-value="mode"
      @update:model-value="$emit('set-mode', $event)"
    />
    <!-- ブラシモード中のクリアボタン -->
    <button
      v-if="mode === 'brush' && brushPointCount > 0"
      type="button"
      class="inline-flex items-center gap-1 rounded-lg border border-border bg-card/90 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-destructive/10 hover:text-destructive"
      title="拾った色をリセット"
      @click="$emit('clear-brush')"
    >
      <RotateCcw :size="13" />
      <span>リセット</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ScanLine, MousePointerClick, RotateCcw } from 'lucide-vue-next'
import { SegmentedControl } from '@/components/ui'
import type { SegmentOption } from '@/components/ui'
import type { GamutMode } from './composables/useGamutBrush'

const props = defineProps<{
  mode: GamutMode
  brushPointCount: number
}>()

defineEmits<{
  'set-mode': [mode: GamutMode]
  'clear-brush': []
}>()

const options = computed<ReadonlyArray<SegmentOption<GamutMode>>>(() => [
  { value: 'bulk', label: '自動', icon: ScanLine },
  {
    value: 'brush',
    label: '手動',
    icon: MousePointerClick,
    badge: props.mode === 'brush' && props.brushPointCount > 0
      ? props.brushPointCount.toLocaleString()
      : undefined,
  },
])
</script>
