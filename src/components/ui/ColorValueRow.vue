<template>
  <div class="flex items-center gap-3">
    <span class="w-6 text-center text-xs font-bold font-mono rounded bg-secondary px-1 py-0.5 text-muted-foreground">
      {{ label }}
    </span>
    <div class="relative h-2 flex-1 rounded-full bg-secondary overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-300"
        :style="{ width: percentage + '%', backgroundColor: color }"
      />
    </div>
    <span class="w-16 text-right text-sm font-mono tabular-nums text-foreground">
      {{ formattedValue }}{{ unit }}
    </span>
    <button
      class="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      :title="copied ? 'コピーしました' : 'コピー'"
      @click="copyValue"
    >
      <component :is="copied ? Check : Copy" class="h-3.5 w-3.5" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, Check } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  label: string
  value: number
  max: number
  unit?: string
  color?: string
  precision?: number
}>(), {
  unit: '',
  color: '#3b82f6',
  precision: 4,
})

const copied = ref(false)

const percentage = computed(() => Math.min((props.value / props.max) * 100, 100))

const formattedValue = computed(() => props.value.toFixed(props.precision))

async function copyValue() {
  try {
    await navigator.clipboard.writeText(formattedValue.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    // Clipboard API が使えない環境（非 HTTPS 等）では静かに失敗
    console.warn('Clipboard API is not available')
  }
}
</script>
