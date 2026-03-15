<template>
  <span :class="cn(badgeVariants({ variant }), $attrs.class as string)">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        success: 'bg-green-100 text-green-700',
        destructive: 'bg-red-100 text-red-700',
        warning: 'bg-amber-100 text-amber-700',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

type BadgeVariants = VariantProps<typeof badgeVariants>

withDefaults(defineProps<{
  variant?: NonNullable<BadgeVariants['variant']>
}>(), {
  variant: 'default',
})
</script>
