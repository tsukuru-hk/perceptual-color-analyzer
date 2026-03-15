<template>
  <TabsRoot
    :default-value="defaultValue"
    :model-value="modelValue"
    @update:model-value="(val: string) => $emit('update:modelValue', val)"
  >
    <slot />
  </TabsRoot>
</template>

<script setup lang="ts">
import { TabsRoot } from 'radix-vue'

defineProps<{
  defaultValue?: string
  modelValue?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
