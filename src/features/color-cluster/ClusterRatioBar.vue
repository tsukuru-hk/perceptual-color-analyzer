<template>
  <div class="space-y-1.5">
    <!-- 並び順トグル -->
    <div class="flex justify-end">
      <SegmentedControl v-model="sortMode" :options="sortOptions" />
    </div>
    <!-- クラスタ占有率の横棒グラフ（幅=占有率、順序は sortMode で切替） -->
    <div class="flex h-6 w-full overflow-hidden rounded-md border border-border">
      <ColorCodeTooltip
        v-for="cluster in sorted"
        :key="cluster.id"
        :rgb="cluster.centroidRgb"
        class="h-full transition-all duration-500 ease-in-out"
        :style="{
          flex: '0 0 ' + cluster.ratio * 100 + '%',
          backgroundColor: rgbToFill(cluster.centroidRgb),
          minWidth: cluster.ratio > 0 ? '2px' : '0',
        }"
      />
    </div>
    <div class="flex flex-wrap gap-x-3 gap-y-1">
      <ColorCodeTooltip
        v-for="cluster in sorted"
        :key="cluster.id"
        :rgb="cluster.centroidRgb"
      >
        <div class="flex items-center gap-1 text-xs text-muted-foreground">
          <span
            class="inline-block h-2.5 w-2.5 rounded-sm border border-border"
            :style="{ backgroundColor: rgbToFill(cluster.centroidRgb) }"
          />
          <span class="tabular-nums">{{ (cluster.ratio * 100).toFixed(1) }}%</span>
        </div>
      </ColorCodeTooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ColorCluster } from '@/domain/colorCluster'
import { ColorCodeTooltip, SegmentedControl } from '@/components/ui'
import type { SegmentOption } from '@/components/ui'

const props = defineProps<{
  clusters: ReadonlyArray<ColorCluster>
}>()

type SortMode = 'ratio' | 'hue'

const sortOptions: ReadonlyArray<SegmentOption<SortMode>> = [
  { value: 'ratio', label: '占有率順' },
  { value: 'hue', label: '色相順' },
]

const sortMode = ref<SortMode>('ratio')

/**
 * 無彩色（グレー）とみなす OKLCH chroma のしきい値。
 * ガマット内最大 chroma が約 0.32 なので、その ~1 割未満を「ほぼ無彩色」とする。
 * 色相順のときこのしきい値未満の色は色相を持たない扱いにして末尾のグレーランプへ寄せる。
 */
const NEUTRAL_CHROMA = 0.03

const sorted = computed(() => {
  const list = [...props.clusters]
  if (sortMode.value === 'ratio') {
    return list.sort((a, b) => b.ratio - a.ratio)
  }

  // 色相順: 有彩色は「色相 → 明度」、無彩色（低彩度）は明度で並べて末尾へ。
  // 無彩色は色相が不安定（グレーの hue はほぼ無意味）なので、
  // 色相ソートに混ぜず明度の明→暗ランプとしてまとめる。
  const chromatic: ColorCluster[] = []
  const neutral: ColorCluster[] = []
  for (const c of list) {
    ;(c.centroid.chroma >= NEUTRAL_CHROMA ? chromatic : neutral).push(c)
  }
  chromatic.sort(
    (a, b) =>
      a.centroid.hue - b.centroid.hue ||
      a.centroid.lightness - b.centroid.lightness,
  )
  neutral.sort((a, b) => b.centroid.lightness - a.centroid.lightness)
  return [...chromatic, ...neutral]
})

function rgbToFill(rgb: { r: number; g: number; b: number }): string {
  return `rgb(${rgb.r},${rgb.g},${rgb.b})`
}
</script>
