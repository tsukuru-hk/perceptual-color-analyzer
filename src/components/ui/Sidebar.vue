<template>
  <!-- グローバル左ナビ：ロゴ + ルートリンク一覧 -->
  <aside class="flex h-screen w-16 flex-col border-r border-border bg-card shrink-0">
    <!-- アプリマーク -->
    <div class="flex h-14 items-center justify-center border-b border-border">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
        P
      </div>
    </div>
    <!-- 主要ルート（分析ページ / デザインシステム） -->
    <nav class="flex-1 flex flex-col gap-1 p-1 pt-2">
      <template v-for="item in items" :key="item.path ?? 'divider'">
        <div v-if="item.type === 'divider'" class="my-1 border-t border-border" />
        <router-link
          v-else
          :to="item.path!"
          :class="cn(
            'flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors',
            isActive(item.path!)
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          )"
        >
          <component :is="item.icon" class="h-5 w-5" />
          <span class="text-[10px] leading-tight text-center truncate w-full">
            {{ item.shortLabel }}
          </span>
        </router-link>
      </template>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { LayoutDashboard, Droplets, Sun, Rainbow, Box, BarChart3, LayoutGrid } from 'lucide-vue-next'
import type { Component } from 'vue'
import { cn } from '@/lib/utils'

const route = useRoute()

interface NavItem {
  type?: 'divider'
  path?: string
  label?: string
  shortLabel?: string
  icon?: Component
}

const items: NavItem[] = [
  { path: '/', label: '総合分析', shortLabel: '総合', icon: LayoutDashboard },
  { path: '/lightness', label: '明度 (Lightness)', shortLabel: '明度', icon: Sun },
  { path: '/chroma', label: '彩度 (Chroma)', shortLabel: '彩度', icon: Droplets },
  { path: '/hue', label: '色相 (Hue)', shortLabel: '色相', icon: Rainbow },
  { path: '/gamut', label: '3D ガマット', shortLabel: '3D', icon: Box },
  { path: '/distribution', label: '色分布', shortLabel: '色分布', icon: BarChart3 },
  { type: 'divider' },
  { path: '/design', label: 'デザインシステム', shortLabel: 'デザイン', icon: LayoutGrid },
]

function isActive(path: string): boolean {
  return route.path === path
}
</script>
