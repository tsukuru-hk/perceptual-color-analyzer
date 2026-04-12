<template>
  <div class="absolute inset-0">
    <TresCanvas :clear-color="'#a0a0a0'">
      <TresPerspectiveCamera :position="[7, 5, 7]" :fov="20" />
      <OrbitControls
        :enable-damping="true"
        :damping-factor="0.08"
      />

      <GamutPointCloud :data="pointCloudData" />

      <GamutReferenceGrid :color-space="colorSpace" />

    </TresCanvas>
  </div>
</template>

<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import type { GamutPointCloudData } from '@/types/analysis'
import type { ColorSpace } from '@/domain/colorSpace'
import GamutPointCloud from './GamutPointCloud.vue'
import GamutReferenceGrid from './GamutReferenceGrid.vue'

withDefaults(defineProps<{
  pointCloudData: GamutPointCloudData | null
  colorSpace?: ColorSpace
}>(), {
  colorSpace: 'srgb',
})
</script>
