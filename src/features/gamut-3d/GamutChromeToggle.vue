<template>
  <button
    type="button"
    class="absolute left-3 top-3 z-20 inline-flex items-center justify-center rounded-lg border border-border bg-card/90 p-1.5 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground"
    :title="modelValue ? '操作パネルを隠す' : '操作パネルを表示'"
    :aria-pressed="!modelValue"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <component :is="modelValue ? EyeOff : Eye" :size="15" />
  </button>
</template>

<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next'

defineProps<{
  modelValue: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
