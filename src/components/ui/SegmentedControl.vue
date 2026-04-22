<template>
  <div
    ref="containerRef"
    role="tablist"
    class="relative inline-flex w-fit items-center rounded-lg bg-secondary p-0.5"
  >
    <!-- スライディングインジケーター -->
    <div
      class="absolute inset-y-0.5 rounded-md bg-card shadow-sm pointer-events-none"
      :class="initialized ? 'transition-all duration-200 ease-out' : ''"
      :style="indicatorStyle"
    />
    <!-- 選択肢 -->
    <button
      v-for="(option, idx) in options"
      :key="String(option.value)"
      :ref="(el) => setButtonRef(el, idx)"
      type="button"
      role="tab"
      :aria-selected="modelValue === option.value"
      :tabindex="modelValue === option.value ? 0 : -1"
      class="relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      :class="modelValue === option.value
        ? 'text-foreground'
        : 'text-muted-foreground hover:text-foreground'"
      @click="select(option.value)"
      @keydown="onKeydown($event, idx)"
    >
      <component :is="option.icon" v-if="option.icon" :size="13" />
      <span>{{ option.label }}</span>
      <span v-if="option.badge != null" class="tabular-nums text-muted-foreground">{{ option.badge }}</span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="V extends string">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onScopeDispose,
  type Component,
} from 'vue'

/**
 * SegmentedControl の 1 選択肢。
 * `V` は呼び出し側で narrow なリテラルユニオンを指定することで、
 * 親コンポーネントの emit 型も自動的に narrow に推論される。
 */
export interface SegmentOption<V extends string = string> {
  value: V
  label: string
  icon?: Component
  badge?: string | number
}

const props = defineProps<{
  options: ReadonlyArray<SegmentOption<V>>
  modelValue: V
}>()

const emit = defineEmits<{
  'update:modelValue': [value: V]
}>()

const containerRef = ref<HTMLElement | null>(null)
const buttonRefs = ref<Array<HTMLElement | null>>([])

function setButtonRef(el: Element | null | { $el?: Element }, idx: number): void {
  // Vue のテンプレート ref callback は `Element` または Component を受け取る。
  // ここでは button 要素のみ想定。
  buttonRefs.value[idx] = (el as HTMLElement | null)
}

const indicatorLeft = ref(0)
const indicatorWidth = ref(0)
const initialized = ref(false)

function getActiveIndex(): number {
  return props.options.findIndex((o) => o.value === props.modelValue)
}

function updateIndicator(): void {
  const idx = getActiveIndex()
  if (idx < 0) return
  const btn = buttonRefs.value[idx]
  if (!btn || btn.offsetWidth === 0) return
  indicatorLeft.value = btn.offsetLeft
  indicatorWidth.value = btn.offsetWidth
}

const indicatorStyle = computed(() => ({
  left: `${indicatorLeft.value}px`,
  width: `${indicatorWidth.value}px`,
  opacity: indicatorWidth.value > 0 ? 1 : 0,
}))

function select(value: V): void {
  if (value === props.modelValue) return
  emit('update:modelValue', value)
}

/** 矢印・Home/End キーでの選択移動（WAI-ARIA Tabs パターン準拠） */
function onKeydown(event: KeyboardEvent, idx: number): void {
  const last = props.options.length - 1
  let nextIdx: number | null = null

  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      nextIdx = idx >= last ? 0 : idx + 1
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      nextIdx = idx <= 0 ? last : idx - 1
      break
    case 'Home':
      nextIdx = 0
      break
    case 'End':
      nextIdx = last
      break
    default:
      return
  }

  event.preventDefault()
  const option = props.options[nextIdx]
  if (!option) return
  buttonRefs.value[nextIdx]?.focus()
  select(option.value)
}

let ro: ResizeObserver | null = null

onMounted(() => {
  // レイアウト確定後に測定 → 次フレームでアニメ有効化
  requestAnimationFrame(() => {
    updateIndicator()
    requestAnimationFrame(() => {
      initialized.value = true
    })
  })

  if (containerRef.value) {
    ro = new ResizeObserver(() => updateIndicator())
    ro.observe(containerRef.value)
  }
})

onScopeDispose(() => {
  ro?.disconnect()
  ro = null
})

watch(() => props.modelValue, async () => {
  await nextTick()
  updateIndicator()
})

watch(
  () => props.options,
  async () => {
    await nextTick()
    // options 配列が入れ替わった直後は要素数が変わる可能性があるため
    // buttonRefs の末尾を切り詰める
    buttonRefs.value.length = props.options.length
    updateIndicator()
  },
  { deep: true },
)
</script>
