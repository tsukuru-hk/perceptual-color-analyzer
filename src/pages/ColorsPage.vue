<template>
  <div>
    <h1 class="text-2xl font-bold text-foreground">OKLCH カラー</h1>
    <p class="mt-1 text-sm text-muted-foreground">色空間の可視化と解析（準備中）</p>
    <Card class="mt-6 p-8 text-center text-muted-foreground">
      <Palette class="mx-auto h-12 w-12 opacity-30" />
      <p class="mt-3 text-sm">3D ガマット可視化、色差計算などの機能を追加予定</p>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Palette } from 'lucide-vue-next'
import { Card } from '@/components/ui'
</script>
