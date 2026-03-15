<template>
  <div v-if="oklchValue" class="oklch-result">
    <strong>選択ピクセル OKLCH</strong>
    <pre>{{ oklchText }}</pre>
    <small>L: 明度, C: 彩度, h: 色相</small>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OklchValue } from '@/domain/oklch'

const props = defineProps<{
  oklchValue: OklchValue | null
}>()

const oklchText = computed(() => {
  const value = props.oklchValue
  if (!value) return '—'
  return `L: ${value.lightness.toFixed(4)}  C: ${value.chroma.toFixed(4)}  h: ${value.hue.toFixed(2)}`
})
</script>

<style scoped>
.oklch-result {
  margin-top: 1.5rem;
  padding: 1rem 1.25rem;
  background: #2d2d2d;
  color: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  border: 1px solid #404040;
}
.oklch-result strong {
  color: rgba(255, 255, 255, 0.95);
}
.oklch-result pre {
  margin: 0.5rem 0;
  font-family: ui-monospace, monospace;
  color: #e0e0e0;
}
.oklch-result small {
  color: rgba(255, 255, 255, 0.6);
}
</style>
