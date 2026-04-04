<template>
  <div v-if="error" class="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-12 text-center">
    <AlertTriangle class="h-10 w-10 text-destructive/70" />
    <div>
      <h3 class="text-sm font-medium text-foreground">ページの表示中にエラーが発生しました</h3>
      <p class="mt-1 text-xs text-muted-foreground">{{ error.message }}</p>
    </div>
    <button
      class="inline-flex items-center gap-1.5 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
      @click="recover"
    >
      <RotateCcw class="h-4 w-4" />
      再読み込み
    </button>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { AlertTriangle, RotateCcw } from 'lucide-vue-next'

const error = ref<Error | null>(null)

onErrorCaptured((err: Error) => {
  error.value = err
  console.error('[ErrorBoundary]', err)
  return false // 伝搬を止める
})

function recover() {
  error.value = null
}
</script>
