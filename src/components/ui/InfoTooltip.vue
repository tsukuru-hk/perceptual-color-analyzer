<template>
  <Tooltip :content="content" side="right" align="center">
    <button
      type="button"
      class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/40 text-[10px] font-medium leading-none text-white transition-colors hover:bg-muted-foreground/60"
    >
      ?
    </button>
  </Tooltip>
</template>

<script setup lang="ts">
import Tooltip from './Tooltip.vue'

defineProps<{
  content: string
}>()
</script>
