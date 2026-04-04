<template>
  <!-- ファイル入力：クリック／D&D で画像を選び検証後に親へ通知 -->
  <div
    :class="cn(
      'rounded-2xl p-8 text-center transition-colors cursor-pointer',
      dragState === 'idle' && 'border-2 border-dashed border-border bg-card hover:border-primary/50 hover:bg-secondary/50',
      dragState === 'dragover' && 'border-2 border-dashed border-primary bg-primary/5',
      dragState === 'error' && 'border-2 border-dashed border-destructive bg-red-50',
    )"
    @click="inputRef?.click()"
    @dragenter.prevent="dragState = 'dragover'"
    @dragover.prevent="dragState = 'dragover'"
    @dragleave.prevent="dragState = 'idle'"
    @drop.prevent="onDrop"
  >
    <!-- 非表示の file input（ラベル／外枠クリックで開く） -->
    <input
      ref="inputRef"
      type="file"
      :accept="accept"
      class="hidden"
      @change="onInputChange"
    />
    <!-- ヒント文とアイコン -->
    <div class="flex flex-col items-center gap-2">
      <component
        :is="dragState === 'dragover' ? FileUp : dragState === 'error' ? AlertCircle : Upload"
        :class="cn(
          'h-10 w-10',
          dragState === 'error' ? 'text-destructive' : 'text-muted-foreground'
        )"
      />
      <p class="text-sm font-medium text-foreground">
        {{ dragState === 'dragover' ? 'ドロップして読み込み' : 'ドラッグ＆ドロップ、またはクリックして画像を選択' }}
      </p>
      <p v-if="errorText" class="text-xs text-destructive">{{ errorText }}</p>
      <p v-else class="text-xs text-muted-foreground">
        最大 {{ Math.round(maxSize / 1024 / 1024) }}MB
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Upload, FileUp, AlertCircle } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  /** `<input type="file">` の accept（例: image/*） */
  accept?: string
  /** 許容する最大ファイルサイズ（バイト） */
  maxSize?: number
}>(), {
  accept: 'image/*',
  maxSize: 10 * 1024 * 1024,
})

const emit = defineEmits<{
  'file-selected': [file: File]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const dragState = ref<'idle' | 'dragover' | 'error'>('idle')
const errorText = ref<string | null>(null)

function validateAndEmit(file: File) {
  errorText.value = null
  dragState.value = 'idle'

  if (props.accept !== '*' && !file.type.match(props.accept.replace('*', '.*'))) {
    errorText.value = '対応していないファイル形式です'
    dragState.value = 'error'
    return
  }
  if (file.size > props.maxSize) {
    errorText.value = `ファイルサイズが${Math.round(props.maxSize / 1024 / 1024)}MBを超えています`
    dragState.value = 'error'
    return
  }
  emit('file-selected', file)
}

function onDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (file) validateAndEmit(file)
  else dragState.value = 'idle'
}

function onInputChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) validateAndEmit(file)
}
</script>
