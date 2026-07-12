<template>
  <div class="absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs shadow-sm backdrop-blur-sm transition-colors"
      :class="modelValue
        ? 'border-primary/60 bg-primary/15 text-foreground'
        : 'border-border bg-card/90 text-muted-foreground hover:text-foreground'"
      title="いま見えている等色相面（同じ色みの断面）に載る点だけを表示する"
      :aria-pressed="modelValue"
      @click="$emit('toggle')"
    >
      <component :is="modelValue ? Check : Layers" :size="13" />
      <span>等色相面モード</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Layers, Check } from 'lucide-vue-next'

defineProps<{
  modelValue: boolean
}>()

defineEmits<{
  toggle: []
}>()
</script>
