<template>
  <!-- ホバー検知ラッパー：aside + タブの両方を包む -->
  <div
    class="fixed inset-y-0 left-0 z-30"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- サイドバー本体 -->
    <aside
      :class="cn(
        'flex h-full flex-col border-r border-border bg-card overflow-hidden',
        'transition-[width,box-shadow] duration-300 ease-in-out',
        isOpen ? 'w-56 shadow-xl' : 'w-14 shadow-none'
      )"
    >
      <div class="flex h-14 w-56 items-center gap-2 border-b border-border px-3">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
          P
        </div>
        <span
          :class="cn(
            'text-sm font-semibold text-foreground whitespace-nowrap',
            'transition-opacity duration-200',
            isOpen ? 'opacity-100' : 'opacity-0'
          )"
        >
          Color Analyzer
        </span>
      </div>
      <nav class="flex-1 space-y-1 p-2">
        <template v-for="item in items" :key="item.path ?? 'divider'">
          <div v-if="item.type === 'divider'" class="my-2 border-t border-border" />
          <router-link
            v-else
            :to="item.path!"
            :class="cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors w-48',
              isActive(item.path!)
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )"
          >
            <component :is="item.icon" class="h-4 w-4 shrink-0" />
            <span
              :class="cn(
                'whitespace-nowrap transition-opacity duration-200',
                isOpen ? 'opacity-100' : 'opacity-0'
              )"
            >
              {{ item.label }}
            </span>
          </router-link>
        </template>
      </nav>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { LayoutDashboard, Droplets, Sun, Rainbow, Box, BarChart3, LayoutGrid } from 'lucide-vue-next'
import type { Component } from 'vue'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/composables/useSidebar'

const route = useRoute()
const { isOpen, open, close } = useSidebar()

interface NavItem {
  type?: 'divider'
  path?: string
  label?: string
  icon?: Component
}

const items: NavItem[] = [
  { path: '/', label: '総合分析', icon: LayoutDashboard },
  { path: '/chroma', label: '彩度 (Chroma)', icon: Droplets },
  { path: '/lightness', label: '明度 (Lightness)', icon: Sun },
  { path: '/hue', label: '色相 (Hue)', icon: Rainbow },
  { path: '/gamut', label: '3D ガマット', icon: Box },
  { path: '/distribution', label: '色分布', icon: BarChart3 },
  { type: 'divider' },
  { path: '/design', label: 'デザインシステム', icon: LayoutGrid },
]

function isActive(path: string): boolean {
  return route.path === path
}

let closeTimer: ReturnType<typeof setTimeout> | null = null

function handleMouseEnter() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  open()
}

function handleMouseLeave() {
  closeTimer = setTimeout(() => {
    close()
    closeTimer = null
  }, 150)
}
</script>
