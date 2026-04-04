<template>
  <!-- ページ：彩度 — Chroma をグレースケール可視化 -->
  <AnalysisPageLayout
    title="彩度分析"
    description="OKLCH Chroma チャンネルの詳細分析"
    :placeholder-icon="Droplets"
    placeholder-text="画像をアップロードすると彩度のグレースケールマップと分布が表示されます"
  >
    <template #default="{ imageData }">
      <div class="space-y-4">
        <div>
          <h3 class="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            彩度グレースケール
            <InfoTooltip content="OKLCH の Chroma 値を 0〜1 に正規化し、グレースケールで可視化したものです。白いほど彩度が高く、黒いほど無彩色に近いことを示します。" />
          </h3>
          <ChromaMapPanel :image-data="imageData" />
        </div>
        <div>
          <h3 class="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            彩度ヒストグラム
            <InfoTooltip content="画像内の全ピクセルの OKLCH Chroma 値の分布を示すヒストグラムです。横軸が彩度、縦軸がピクセル数を表します。" />
            <span class="ml-auto flex items-center gap-1 scale-75 origin-right">
              <span class="text-[10px] text-muted-foreground select-none">Log</span>
              <Toggle v-model="chromaLogScale" />
            </span>
          </h3>
          <ChromaHistogramPanel :image-data="imageData" :log-scale="chromaLogScale" />
        </div>
        <div>
          <Legend
            title="Chroma (彩度)"
            min-label="0 (無彩色)"
            max-label="0.4+ (高彩度)"
            gradient="linear-gradient(to right, #000, #666, #fff)"
          />
        </div>
      </div>
    </template>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Droplets } from 'lucide-vue-next'
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { Legend, InfoTooltip, Toggle } from '@/components/ui'
import { ChromaMapPanel, ChromaHistogramPanel } from '@/features/grayscale-map'

const chromaLogScale = ref(false)
</script>
