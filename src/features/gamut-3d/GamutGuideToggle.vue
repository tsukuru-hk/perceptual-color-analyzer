<template>
  <div class="absolute bottom-3 left-3 z-10">
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs shadow-sm backdrop-blur-sm transition-colors"
      :class="modelValue
        ? 'border-primary/60 bg-primary/15 text-foreground'
        : 'border-border bg-card/90 text-muted-foreground hover:text-foreground'"
      :title="modelValue ? '見方ガイドを隠す' : '軸=明度・外周=色相・中心からの距離=彩度の見方ガイドを表示'"
      :aria-pressed="modelValue"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <Compass :size="13" />
      <span>見方</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Compass } from 'lucide-vue-next'

defineProps<{
  modelValue: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
