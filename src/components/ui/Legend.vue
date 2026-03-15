<template>
  <div class="space-y-1.5">
    <p v-if="title" class="text-xs font-medium text-foreground">{{ title }}</p>
    <div
      class="h-3 w-full rounded-full"
      :style="{ background: gradient }"
    />
    <div class="flex justify-between">
      <span class="text-xs text-muted-foreground">{{ minLabel }}</span>
      <span class="text-xs text-muted-foreground">{{ maxLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  minLabel: string
  maxLabel: string
  gradient: string
}>()
</script>
