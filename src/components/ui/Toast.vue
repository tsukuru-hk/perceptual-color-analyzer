<template>
  <div :class="cn(toastVariants({ variant }), $attrs.class as string)">
    <div class="flex-1">
      <p class="text-sm font-medium">{{ title }}</p>
      <p v-if="description" class="mt-0.5 text-xs opacity-80">{{ description }}</p>
    </div>
    <button
      class="ml-3 shrink-0 rounded-md p-1 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
      @click="$emit('close')"
    >
      <X class="h-3.5 w-3.5" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const toastVariants = cva(
  'flex items-start rounded-xl border px-4 py-3 shadow-lg min-w-72 max-w-sm',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-foreground',
        success: 'border-green-200 bg-green-50 text-green-900',
        error: 'border-red-200 bg-red-50 text-red-900',
        info: 'border-blue-200 bg-blue-50 text-blue-900',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

type ToastVariants = VariantProps<typeof toastVariants>

withDefaults(defineProps<{
  title: string
  description?: string
  variant?: NonNullable<ToastVariants['variant']>
}>(), {
  variant: 'default',
})

defineEmits<{
  close: []
}>()
</script>
