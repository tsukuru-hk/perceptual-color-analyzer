<template>
  <TabsList
    :class="cn(
      'inline-flex h-10 items-center justify-center rounded-xl bg-secondary p-1 text-muted-foreground',
      $attrs.class as string
    )"
  >
    <slot />
  </TabsList>
</template>

<script setup lang="ts">
import { TabsList } from 'radix-vue'
import { cn } from '@/lib/utils'
</script>
