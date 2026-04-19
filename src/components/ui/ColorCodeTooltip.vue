<template>
  <!--
    カラーコードツールチップ。
    ホバーで色コードを表示、クリックでコピー。
    fixed 配置なので overflow:hidden の中でも表示される。
  -->
  <div
    ref="anchorRef"
    class="color-tooltip-anchor"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @click="copyColor"
  >
    <slot />
    <Teleport to="body">
      <Transition name="tooltip-fade">
        <div
          v-if="show"
          class="color-tooltip"
          :class="{ copied }"
          :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
        >
          <span class="color-tooltip-text">{{ copied ? 'Copied!' : hex }}</span>
          <div class="color-tooltip-arrow" :class="{ copied }" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  rgb: { r: number; g: number; b: number }
}>()

const anchorRef = ref<HTMLElement>()
const show = ref(false)
const copied = ref(false)
const pos = ref({ x: 0, y: 0 })

const hex = computed(() => {
  const { r, g, b } = props.rgb
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
})

function onEnter() {
  show.value = true
  updatePosition()
}

function onLeave() {
  show.value = false
  copied.value = false
}

function updatePosition() {
  const el = anchorRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  pos.value = {
    x: rect.left + rect.width / 2,
    y: rect.top,
  }
}

async function copyColor() {
  try {
    await navigator.clipboard.writeText(hex.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1200)
  } catch {
    // clipboard API 未対応環境は無視
  }
}
</script>

<style>
/* Teleport 先なので scoped にしない */
.color-tooltip-anchor {
  position: relative;
  cursor: pointer;
}

.color-tooltip {
  position: fixed;
  transform: translate(-50%, -100%);
  margin-top: -6px;
  padding: 3px 7px;
  background: #1a1a1a;
  color: #f0f0f0;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  line-height: 1.4;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 9999;
}

.color-tooltip.copied {
  background: #166534;
}

.color-tooltip-arrow {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: #1a1a1a;
}

.color-tooltip-arrow.copied {
  border-top-color: #166534;
}

.color-tooltip-text {
  user-select: none;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 150ms ease;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}
</style>
