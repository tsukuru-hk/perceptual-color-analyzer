<template>
  <!-- 分析ページ共通レイアウト：見出し → 画像投入 or ギャラリー付き分析エリア -->
  <div>
    <!-- ページ見出し -->
    <div class="flex items-center gap-3">
      <div v-if="slots['title-icon']" class="flex h-14 w-14 shrink-0 items-center justify-center">
        <slot name="title-icon" />
      </div>
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-2xl font-bold text-foreground">{{ title }}</h1>
          <button
            v-if="slots.explanation"
            class="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-white px-3 py-1 text-sm font-medium text-sky-500 transition-colors hover:bg-sky-50"
            @click="showExplanation = true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            解説
          </button>
        </div>
        <!-- モバイルでは上部がテキストで詰まるため説明文を非表示にする -->
        <p v-if="description" class="mt-1 hidden text-sm text-muted-foreground md:block">{{ description }}</p>
      </div>
    </div>

    <!-- 解説モーダル -->
    <ExplanationModal v-if="slots.explanation" v-model="showExplanation">
      <slot name="explanation" :close="() => showExplanation = false" />
    </ExplanationModal>

    <!-- 分析エリア：画像が1枚以上あるとき — タブバー + 2カラム（オリジナル / 分析結果） -->
    <div v-if="images.length > 0" class="mt-6 overflow-hidden rounded-xl border-2 border-border">
      <ImageGalleryBar />

      <!-- Split Pane モード：ドラッグで比率調整可能（md 以上のみ） -->
      <SplitPane v-if="selectedImage && splitPane && isDesktop" :default-ratio="0.3" :min-ratio="0.15" :max-ratio="0.85" :class="[paneHeight, 'bg-card']">
        <template #left>
          <div class="relative h-full overflow-auto p-4">
            <SectionLabel>オリジナル画像</SectionLabel>
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

      <!-- Split Pane モード（モバイル）：ドラッグ操作が不向きなため縦積みにフォールバック -->
      <div v-else-if="selectedImage && splitPane" class="bg-card">
        <div class="relative p-4">
          <SectionLabel>オリジナル画像</SectionLabel>
          <slot v-if="slots.left" name="left" :color-aware-image-data="selectedImage!.colorAwareImageData" />
          <ImageCanvas v-else :image-data="selectedImage!.colorAwareImageData.imageData" />
        </div>
        <!-- 分析スロットは h-full 前提のため明示的な高さを与える -->
        <div class="relative h-[55dvh] border-t-2 border-border">
          <slot :color-aware-image-data="selectedImage.colorAwareImageData" />
        </div>
      </div>

      <!-- フルワイドモード：スロットに全幅を委ねる -->
      <div v-else-if="selectedImage && fullWidth" class="bg-card p-4">
        <slot :color-aware-image-data="selectedImage.colorAwareImageData" />
      </div>

      <!-- 通常モード：2 カラム（モバイルは縦積み） -->
      <div v-else-if="selectedImage" class="grid grid-cols-1 gap-4 bg-card p-4 md:grid-cols-2 md:gap-6">
        <div>
          <SectionLabel>オリジナル画像</SectionLabel>
          <slot v-if="slots.left" name="left" :color-aware-image-data="selectedImage.colorAwareImageData" />
          <ImageCanvas v-else :image-data="selectedImage.colorAwareImageData.imageData" />
        </div>
        <div>
          <SectionLabel v-if="analysisTitle">{{ analysisTitle }}</SectionLabel>
          <slot :color-aware-image-data="selectedImage.colorAwareImageData" />
        </div>
      </div>
      <div v-if="loadProgress === 'loading'" class="bg-card p-6 text-sm text-muted-foreground">読み込み中...</div>
    </div>

    <!-- 初回：画像未選択 — 画面中央にドロップゾーン -->
    <div v-else class="flex flex-1 items-center justify-center min-h-[calc(100dvh-18rem)] md:min-h-[calc(100vh-12rem)]">
      <div class="w-full max-w-2xl">
        <div class="mb-4 flex justify-center">
          <div class="flex items-center gap-2 min-w-0">
            <div ref="uploadLottieRef" class="h-16 w-16 shrink-0" />
            <!-- モバイルでは折り返し可（invisible スパンが全文分の幅を確保するためタイプ中もレイアウトが安定する） -->
            <p class="text-lg font-bold text-muted-foreground md:text-2xl md:whitespace-nowrap">{{ typedText }}<span class="invisible">{{ placeholderText.slice(typedCount) }}</span></p>
          </div>
        </div>
        <DropZone class="aspect-[5/4]" @hover-change="onDropzoneHover" @files-selected="onFilesSelected" />
        <div v-if="loadProgress === 'loading'" class="mt-4 text-center text-sm text-muted-foreground">読み込み中...</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, useSlots } from 'vue'
import { DropZone, SplitPane, SectionLabel } from '@/components/ui'
import ExplanationModal from '@/components/ui/ExplanationModal.vue'
import ImageGalleryBar from '@/components/ui/ImageGalleryBar.vue'
import ImageCanvas from '@/features/image-analysis/ImageCanvas.vue'
import { useImageStore } from '@/composables/useImageStore'
import { usePasteImage } from '@/composables/usePasteImage'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { useToast } from '@/composables/useToast'
import { useLottie } from '@/composables/useLottie'
import uploadWaitData from '@/assets/animations/LottieAnimeUploadWait.json'
import uploadHoverData from '@/assets/animations/LottieAnimeUploadHover.json'

const props = withDefaults(defineProps<{
  /** ページタイトル（h1） */
  title: string
  /** タイトル直下の説明文 */
  description?: string
  /** 右カラム見出し（例: 「彩度グレースケール」） */
  analysisTitle?: string
  /** 画像未投入時のヒントテキスト */
  placeholderText?: string
  /** Split Pane モード（ドラッグで比率調整可能な 2 ペイン） */
  splitPane?: boolean
  /** SplitPane の高さクラス（デフォルト: h-[70vh]） */
  paneHeight?: string
  /** フルワイドモード（2 カラムを無効化し、スロットに全幅を委ねる） */
  fullWidth?: boolean
}>(), {
  placeholderText: '画像をアップロードすると分析結果が表示されます',
  splitPane: false,
  paneHeight: 'h-[70vh]',
  fullWidth: false,
})

const slots = useSlots()
const showExplanation = ref(false)
/** md 以上か — SplitPane（ドラッグ操作）はデスクトップのみ有効にする */
const isDesktop = useMediaQuery('(min-width: 768px)')
const { images, selectedImage, loadProgress, canAddMore, addImage } = useImageStore()
const { toast } = useToast()


const uploadLottieRef = ref<HTMLDivElement | null>(null)
/** Lottie の表示用アニメデータ。`useLottie` に Ref で渡すとホバー時も再ロードされる。 */
const currentUploadAnim = ref<unknown>(uploadWaitData)
useLottie(uploadLottieRef, currentUploadAnim, { loop: true, autoplay: true })

/** 直前のホバー状態。不要な再ロードを避けるためのメモ。 */
let lastHovered = false
function onDropzoneHover(hovered: boolean): void {
  if (hovered === lastHovered) return
  lastHovered = hovered
  currentUploadAnim.value = hovered ? uploadHoverData : uploadWaitData
}

/**
 * DropZone から受けた妥当なファイル群を直列に投入する。
 * - 並列だと `loadProgress` の状態が競合するため直列化。
 * - 上限に達したら残件を破棄し、一度だけトーストで通知する（フェイルクローズド）。
 */
async function onFilesSelected(files: File[]): Promise<void> {
  let skipped = 0
  for (const [index, file] of files.entries()) {
    if (!canAddMore.value) {
      skipped = files.length - index
      break
    }
    await addImage(file)
  }
  if (skipped > 0) {
    toast({
      title: `${skipped} 件を追加できませんでした`,
      description: '画像枚数の上限に達しています。',
      variant: 'info',
    })
  }
}

// クリップボードの画像を Cmd/Ctrl+V で貼り付けても追加できるようにする
usePasteImage(onFilesSelected)

// ── タイプライターエフェクト ──
const typedCount = ref(0)
let typeTimer: ReturnType<typeof setInterval> | null = null

function startTypewriter(text: string): void {
  if (typeTimer) {
    clearInterval(typeTimer)
    typeTimer = null
  }
  typedCount.value = 0
  const totalChars = text.length
  if (totalChars === 0) return
  const interval = Math.max(500 / totalChars, 16)
  typeTimer = setInterval(() => {
    typedCount.value++
    if (typedCount.value >= totalChars && typeTimer) {
      clearInterval(typeTimer)
      typeTimer = null
    }
  }, interval)
}

const typedText = computed(() => props.placeholderText.slice(0, typedCount.value))

// placeholderText が動的に変わっても安全に再始動する
watch(
  () => props.placeholderText,
  (text) => startTypewriter(text),
)

// 画像数の変化を監視：全削除時にリセット
watch(
  () => images.value.length,
  (newLen, oldLen) => {
    if (newLen === 0 && oldLen > 0) {
      lastHovered = false
      currentUploadAnim.value = uploadWaitData
      startTypewriter(props.placeholderText)
    }
  },
)

onMounted(() => {
  startTypewriter(props.placeholderText)
})

onBeforeUnmount(() => {
  if (typeTimer) clearInterval(typeTimer)
})
</script>
