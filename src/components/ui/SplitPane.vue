<template>
  <div ref="containerRef" class="flex w-full">
    <div class="shrink-0 overflow-hidden" :style="{ width: leftWidth }">
      <slot name="left" />
    </div>
    <div
      class="w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/50 active:bg-primary"
      @pointerdown="onPointerDown"
    />
    <div class="min-w-0 flex-1 overflow-hidden">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  defaultRatio?: number
  minRatio?: number
  maxRatio?: number
}>(), {
  defaultRatio: 0.3,
  minRatio: 0.15,
  maxRatio: 0.85,
})

const containerRef = ref<HTMLElement | null>(null)
const ratio = ref(props.defaultRatio)

const leftWidth = computed(() => `${ratio.value * 100}%`)

function onPointerDown(e: PointerEvent) {
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)

  const container = containerRef.value
  if (!container) return

  const onMove = (ev: PointerEvent) => {
    const rect = container.getBoundingClientRect()
    const newRatio = (ev.clientX - rect.left) / rect.width
    ratio.value = Math.min(props.maxRatio, Math.max(props.minRatio, newRatio))
  }

  const onUp = () => {
    target.removeEventListener('pointermove', onMove)
    target.removeEventListener('pointerup', onUp)
  }

  target.addEventListener('pointermove', onMove)
  target.addEventListener('pointerup', onUp)
}
</script>
