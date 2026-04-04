<template>
  <div class="flex flex-col items-center justify-center gap-3 rounded-lg bg-destructive/5 border border-destructive/20 p-8 text-center">
    <AlertTriangle class="h-8 w-8 text-destructive/70" />
    <p class="text-sm text-destructive/90">{{ message }}</p>
    <button
      class="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
      @click="$emit('retry')"
    >
      <RotateCcw class="h-3.5 w-3.5" />
      再試行
    </button>
  </div>
</template>

<script setup lang="ts">
import { AlertTriangle, RotateCcw } from 'lucide-vue-next'

defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
</script>
