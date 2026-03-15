<template>
  <aside class="fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-border bg-card">
    <div class="flex h-14 items-center gap-2 border-b border-border px-4">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
        P
      </div>
      <span class="text-sm font-semibold text-foreground">Color Analyzer</span>
    </div>
    <nav class="flex-1 space-y-1 p-3">
      <router-link
        v-for="item in items"
        :key="item.path"
        :to="item.path"
        :class="cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive(item.path)
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
        )"
      >
        <component :is="item.icon" class="h-4 w-4" />
        {{ item.label }}
      </router-link>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Palette, LayoutGrid, Image } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const route = useRoute()

const items = [
  { path: '/', label: '画像解析', icon: Image },
  { path: '/design', label: 'デザインシステム', icon: LayoutGrid },
  { path: '/colors', label: 'OKLCH カラー', icon: Palette },
]

function isActive(path: string): boolean {
  return route.path === path
}
</script>
