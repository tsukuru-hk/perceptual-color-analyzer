<template>
  <TabsContent
    :value="value"
    :class="cn('mt-4 focus-visible:outline-none', $attrs.class as string)"
  >
    <slot />
  </TabsContent>
</template>

<script setup lang="ts">
import { TabsContent } from 'radix-vue'
import { cn } from '@/lib/utils'

defineProps<{
  value: string
}>()
</script>
