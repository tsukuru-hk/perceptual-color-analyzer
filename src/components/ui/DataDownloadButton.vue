<template>
  <!--
    分析データ（AI 分析用 JSON）を保存する控えめなボタン。
    画像 DL（DownloadButton）と紛れないよう、アイコンではなく "JSON" テキストで表す。
  -->
  <Tooltip :content="title" :side="variant === 'overlay' ? 'bottom' : 'top'">
    <button
      type="button"
      :class="buttonClass"
      :aria-label="title"
      :disabled="disabled"
      @click="$emit('click')"
    >
      <Braces :size="iconSize" :stroke-width="2" />
      <span class="text-[10px] font-semibold tracking-wide">{{ label }}</span>
    </button>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Braces } from 'lucide-vue-next'
import Tooltip from './Tooltip.vue'

const props = withDefaults(defineProps<{
  /** ツールチップ / aria-label */
  title?: string
  /** ボタンに表示する短いフォーマット名（例: "CSV" / "JSON"） */
  label?: string
  /** 無効化（結果が未生成のときなど） */
  disabled?: boolean
  /** 見た目: 通常（白背景）か overlay（3D 上の暗色オーバーレイ） */
  variant?: 'default' | 'overlay'
}>(), {
  title: '分析データをダウンロード（AI 分析用）',
  label: 'DATA',
  disabled: false,
  variant: 'default',
})

defineEmits<{ click: [] }>()

const iconSize = computed(() => (props.variant === 'overlay' ? 13 : 12))

const buttonClass = computed(() => {
  const base =
    'inline-flex shrink-0 items-center gap-1 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40'
  if (props.variant === 'overlay') {
    return `${base} h-8 px-2 border border-white/15 bg-black/30 text-white/70 backdrop-blur-sm hover:bg-black/50 hover:text-white`
  }
  return `${base} h-7 px-2 border border-border/70 bg-transparent text-muted-foreground/80 hover:bg-muted hover:text-foreground`
})
</script>
