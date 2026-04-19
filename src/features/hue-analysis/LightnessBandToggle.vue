<template>
  <!-- 明度帯フィルタ: All / Dark / Mid / Light -->
  <Tabs :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <TabsList>
      <TabsTrigger value="all">All</TabsTrigger>
      <TabsTrigger value="dark">Dark</TabsTrigger>
      <TabsTrigger value="mid">Mid</TabsTrigger>
      <TabsTrigger value="light">Light</TabsTrigger>
    </TabsList>
  </Tabs>
</template>

<script setup lang="ts">
import { Tabs, TabsList, TabsTrigger } from '@/components/ui'

defineProps<{
  modelValue: 'all' | 'dark' | 'mid' | 'light'
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
