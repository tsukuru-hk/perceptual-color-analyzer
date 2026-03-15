<template>
  <AnalysisPageLayout
    title="色相分析"
    description="OKLCH Hue チャンネルの詳細分析"
    :placeholder-icon="Rainbow"
  >
    <Card class="p-8 text-center text-muted-foreground">
      <Rainbow class="mx-auto h-12 w-12 opacity-30" />
      <p class="mt-3 text-sm">色相ホイール・色相マップ・支配的色相クラスタを実装予定</p>
    </Card>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { Rainbow } from 'lucide-vue-next'
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { Card } from '@/components/ui'
</script>
