<template>
  <Card>
    <CardHeader v-if="title">
      <CardTitle>{{ title }}</CardTitle>
      <p v-if="description" class="text-sm text-muted-foreground">{{ description }}</p>
    </CardHeader>
    <CardContent>
      <slot />
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import Card from './Card.vue'
import CardHeader from './CardHeader.vue'
import CardTitle from './CardTitle.vue'
import CardContent from './CardContent.vue'

defineProps<{
  title?: string
  description?: string
}>()
</script>
