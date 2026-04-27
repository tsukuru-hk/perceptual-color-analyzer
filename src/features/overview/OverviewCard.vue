<template>
  <router-link :to="to" class="block group outline-none">
    <div class="overflow-hidden rounded-xl border border-border bg-card transition-all group-hover:border-primary/40 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
      <div class="aspect-[4/3] relative overflow-hidden bg-muted/20">
        <!-- Loading -->
        <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
          <div class="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
        <!-- Error -->
        <div v-else-if="error" class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
          <AlertTriangle class="h-5 w-5 text-destructive/70" />
          <button
            class="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[10px] font-medium text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
            @click.stop.prevent="$emit('retry')"
          >
            <RotateCcw class="h-3 w-3" />
            再試行
          </button>
        </div>
        <!-- Content (non-interactive preview) -->
        <div v-else class="pointer-events-none h-full w-full">
          <slot />
        </div>
      </div>
      <div class="px-3 py-2 text-xs font-medium text-muted-foreground truncate">
        {{ title }}
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { AlertTriangle, RotateCcw } from 'lucide-vue-next'

defineProps<{
  title: string
  to: string
  loading: boolean
  error: boolean
}>()

defineEmits<{ retry: [] }>()
</script>
