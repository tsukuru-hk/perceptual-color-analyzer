<template>
  <!-- 分析ページ共通レイアウト：見出し → 画像投入 or ギャラリー付き分析エリア -->
  <div>
    <!-- ページ見出し -->
    <h1 class="text-2xl font-bold text-foreground">{{ title }}</h1>
    <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>

    <!-- 分析エリア：画像が1枚以上あるとき — タブバー + 2カラム（オリジナル / 分析結果） -->
    <div v-if="images.length > 0" class="mt-6 overflow-hidden rounded-xl border border-border">
      <ImageGalleryBar />
      <!-- Split Pane モード：ドラッグで比率調整可能 -->
      <SplitPane v-if="selectedImage && splitPane" :default-ratio="0.3" :min-ratio="0.15" :max-ratio="0.85" :class="[paneHeight, 'bg-card']">
        <template #left>
          <div class="h-full overflow-auto p-4">
            <h3 class="mb-2 text-sm font-medium text-muted-foreground">オリジナル画像</h3>
            <slot v-if="slots.left" name="left" :color-aware-image-data="selectedImage!.colorAwareImageData" />
            <ImageCanvas v-else :image-data="selectedImage!.colorAwareImageData.imageData" />
          </div>
        </template>
        <template #right>
          <div class="relative h-full">
            <slot :color-aware-image-data="selectedImage.colorAwareImageData" />
          </div>
        </template>
      </SplitPane>
      <!-- 通常モード：固定 2 カラム -->
      <div v-else-if="selectedImage" class="grid grid-cols-2 gap-6 bg-card p-4">
        <div>
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">オリジナル画像</h3>
          <ImageCanvas :image-data="selectedImage.colorAwareImageData.imageData" />
        </div>
        <div>
          <h3 v-if="analysisTitle" class="mb-2 text-sm font-medium text-muted-foreground">{{ analysisTitle }}</h3>
          <slot :color-aware-image-data="selectedImage.colorAwareImageData" />
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
import { useSlots, type Component } from 'vue'
import { DropZone, SplitPane } from '@/components/ui'
import ImageGalleryBar from '@/components/ui/ImageGalleryBar.vue'
import ImageCanvas from '@/features/image-analysis/ImageCanvas.vue'
import { useImageStore } from '@/composables/useImageStore'

const slots = useSlots()

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
  /** Split Pane モード（ドラッグで比率調整可能な 2 ペイン） */
  splitPane?: boolean
  /** SplitPane の高さクラス（デフォルト: h-[70vh]） */
  paneHeight?: string
}>(), {
  placeholderText: '画像をアップロードすると分析結果が表示されます',
  splitPane: false,
  paneHeight: 'h-[70vh]',
})

const { images, selectedImage, loadProgress, addImage } = useImageStore()
</script>
