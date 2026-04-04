<template>
  <!-- 分析ページ共通レイアウト：見出し → 画像投入 or ギャラリー付き分析エリア -->
  <div>
    <!-- ページ見出し -->
    <h1 class="text-2xl font-bold text-foreground">{{ title }}</h1>
    <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>

    <!-- 分析エリア：画像が1枚以上あるとき — タブバー + 2カラム（オリジナル / 分析結果） -->
    <div v-if="images.length > 0" class="mt-6 overflow-hidden rounded-xl border border-border">
      <ImageGalleryBar />
      <div v-if="selectedImage" class="grid grid-cols-2 gap-6 bg-card p-4">
        <div>
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">オリジナル画像</h3>
          <ImageCanvas :image-data="selectedImage.imageData" />
        </div>
        <div>
          <h3 v-if="analysisTitle" class="mb-2 text-sm font-medium text-muted-foreground">{{ analysisTitle }}</h3>
          <slot :image-data="selectedImage.imageData" />
        </div>
      </div>
      <div v-if="loadProgress === 'loading'" class="bg-card p-6 text-sm text-muted-foreground">読み込み中...</div>
    </div>

    <!-- 初回：画像未選択 — ドロップゾーンのみ -->
    <div v-else class="mt-6">
      <DropZone accept="image/*" @file-selected="addImage" />
      <div v-if="loadProgress === 'loading'" class="mt-4 text-sm text-muted-foreground">読み込み中...</div>
    </div>

    <!-- ヒント：画像がまだ無いときのプレースホルダー -->
    <div v-if="images.length === 0 && loadProgress !== 'loading'" class="mt-12 text-center text-muted-foreground">
      <component :is="placeholderIcon" class="mx-auto h-12 w-12 opacity-30" />
      <p class="mt-3 text-sm">{{ placeholderText }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { DropZone } from '@/components/ui'
import ImageGalleryBar from '@/components/ui/ImageGalleryBar.vue'
import ImageCanvas from '@/features/image-analysis/ImageCanvas.vue'
import { useImageStore } from '@/composables/useImageStore'

withDefaults(defineProps<{
  /** ページタイトル（h1） */
  title: string
  /** タイトル直下の説明文 */
  description?: string
  /** 右カラム見出し（例: 「彩度グレースケール」） */
  analysisTitle?: string
  /** 画像未投入時に表示するアイコン */
  placeholderIcon?: Component
  /** 画像未投入時のヒントテキスト */
  placeholderText?: string
}>(), {
  placeholderText: '画像をアップロードすると分析結果が表示されます',
})

const { images, selectedImage, loadProgress, addImage } = useImageStore()
</script>
