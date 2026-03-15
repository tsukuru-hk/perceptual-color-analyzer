<template>
  <AnalysisPageLayout
    title="3D ガマット"
    description="OKLCH 色空間での 3D ポイントクラウド可視化"
    :placeholder-icon="Box"
  >
    <Card class="p-8 text-center text-muted-foreground">
      <Box class="mx-auto h-12 w-12 opacity-30" />
      <p class="mt-3 text-sm">TresJS/Three.js による 3D ガマット可視化を実装予定</p>
    </Card>
  </AnalysisPageLayout>
</template>

<script setup lang="ts">
import { Box } from 'lucide-vue-next'
import AnalysisPageLayout from '@/components/ui/AnalysisPageLayout.vue'
import { Card } from '@/components/ui'
</script>
