<template>
  <TooltipProvider :delay-duration="200">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side="side"
          :align="align"
          :side-offset="4"
          :class="cn(
            'z-50 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground shadow-md',
            'data-[state=delayed-open]:animate-tooltip-in data-[state=closed]:animate-tooltip-out',
            $attrs.class as string
          )"
        >
          {{ content }}
          <TooltipArrow class="fill-card" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'radix-vue'
import { cn } from '@/lib/utils'

withDefaults(defineProps<{
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}>(), {
  side: 'top',
  align: 'center',
})
</script>
