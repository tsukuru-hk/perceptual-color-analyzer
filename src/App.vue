<template>
  <!-- アプリシェル：左ナビ + メイン（ルートごとのページ）+ グローバル通知 -->
  <div class="flex min-h-screen bg-background">
    <!-- グローバルナビゲーション -->
    <Sidebar />
    <!-- ルートに応じたページ（分析・デザインシステムなど） -->
    <main class="flex-1 min-w-0 p-6 overflow-auto">
      <ErrorBoundary>
        <router-view />
      </ErrorBoundary>
    </main>
    <Toaster />
  </div>
</template>

<script setup lang="ts">
import { Sidebar, Toaster, ErrorBoundary } from '@/components/ui'
</script>
