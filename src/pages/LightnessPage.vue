<template>
  <!-- ページ：明度 — Lightness をグレースケール可視化 -->
  <AnalysisPageLayout
    title="明度分析"
    description="OKLCH Lightness チャンネルの詳細分析"
    :placeholder-icon="Sun"
    placeholder-text="画像をアップロードすると明度のグレースケールマップと分布が表示されます"
  >
    <template #default="{ imageData }">
      <div class="space-y-4">
        <div>
          <h3 class="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            明度グレースケール
            <InfoTooltip content="OKLCH の Lightness 値をそのままグレースケールで可視化したものです。白いほど明るく、黒いほど暗いピクセルであることを示します。" />
          </h3>
          <LightnessMapPanel :image-data="imageData" />
        </div>
        <div>
          <h3 class="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            明度ヒストグラム
            <InfoTooltip content="画像内の全ピクセルの OKLCH Lightness 値の分布を示すヒストグラムです。横軸が明度、縦軸がピクセル数を表します。" />
            <span class="ml-auto flex items-center gap-1 scale-75 origin-right">
              <span class="text-[10px] text-muted-foreground select-none">Log</span>
              <Toggle v-model="lightnessLogScale" />
            </span>
          </h3>
          <LightnessHistogramPanel :image-data="imageData" :log-scale="lightnessLogScale" />
        </div>
        <div>
          <Legend
            title="Lightness (明度)"
            min-label="0 (黒)"
            max-label="1.0 (白)"
            gradient="linear-gradient(to right, #000, #fff)"
          />
        </div>
      </div>
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Sun } from 'lucide-vue-next'
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { Legend, InfoTooltip, Toggle } from '@/components/ui'
import { LightnessMapPanel, LightnessHistogramPanel } from '@/features/lightness-map'

const lightnessLogScale = ref(false)
</script>
