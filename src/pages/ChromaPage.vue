<template>
  <AnalysisPageLayout
    title="彩度分析"
    description="OKLCH Chroma チャンネルの詳細分析"
    :placeholder-icon="Droplets"
  >
    <Card class="p-8 text-center text-muted-foreground">
      <Droplets class="mx-auto h-12 w-12 opacity-30" />
      <p class="mt-3 text-sm">彩度マップ・ヒストグラム・統計情報を実装予定</p>
    </Card>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { Droplets } from 'lucide-vue-next'
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { Card } from '@/components/ui'
</script>
