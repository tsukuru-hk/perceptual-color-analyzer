<template>
  <div ref="containerRef" :style="containerStyle" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import lottie, { type AnimationItem } from 'lottie-web'

const props = withDefaults(
  defineProps<{
    /** Lottie アニメーション JSON データ */
    animationData: object
    /** ループ再生するか（デフォルト: true） */
    loop?: boolean
    /** 自動再生するか（デフォルト: true） */
    autoplay?: boolean
    /** 幅（数値の場合は px、文字列の場合はそのまま CSS 値として使用） */
    width?: number | string
    /** 高さ（数値の場合は px、文字列の場合はそのまま CSS 値として使用） */
    height?: number | string
  }>(),
  {
    loop: true,
    autoplay: true,
    width: 200,
    height: 200,
  },
)

const emit = defineEmits<{
  /** アニメーションが1周完了したとき（loop: false のとき有効） */
  complete: []
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let animation: AnimationItem | null = null

const containerStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
}))

function loadAnimation() {
  if (!containerRef.value) return
  animation?.destroy()
  animation = lottie.loadAnimation({
    container: containerRef.value,
    renderer: 'svg',
    loop: props.loop,
    autoplay: props.autoplay,
    animationData: props.animationData,
  })
  animation.addEventListener('complete', () => emit('complete'))
}

onMounted(loadAnimation)
watch(() => props.animationData, loadAnimation)
onUnmounted(() => animation?.destroy())
</script>
