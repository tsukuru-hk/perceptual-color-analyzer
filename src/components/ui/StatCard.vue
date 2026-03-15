<template>
  <Card class="relative overflow-hidden">
    <CardHeader>
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">{{ label }}</span>
        <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
          <component :is="icon" class="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div class="flex items-end justify-between">
        <div>
          <p class="text-2xl font-bold text-foreground">{{ value }}</p>
          <Badge :variant="trend >= 0 ? 'success' : 'destructive'" class="mt-1.5">
            {{ trend >= 0 ? '+' : '' }}{{ trend }}%
          </Badge>
        </div>
        <!-- Mini sparkline placeholder -->
        <svg class="h-10 w-20 opacity-60" viewBox="0 0 80 40">
          <polyline
            fill="none"
            :stroke="chartColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            :points="sparklinePoints"
          />
        </svg>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Card, CardHeader, CardContent, Badge } from '@/components/ui'

const props = defineProps<{
  label: string
  value: string
  trend: number
  icon: Component
  chartColor: string
}>()

const sparklinePoints = computed(() => {
  const seed = props.label.length + Math.abs(props.trend)
  const points = Array.from({ length: 8 }, (_, i) => {
    const y = 20 + Math.sin(i * 0.8 + seed) * 12 + Math.cos(i * 1.3) * 6
    return `${i * 11.4},${y}`
  })
  return points.join(' ')
})
</script>
