<template>
  <div class="absolute inset-0">
    <TresCanvas :clear-color="'#d4d4d4'">
      <TresPerspectiveCamera :position="[7, 5, 7]" :fov="20" />
      <OrbitControls
        :enable-damping="true"
        :damping-factor="0.08"
      />

      <GamutPointCloud :data="pointCloudData" />

      <GamutReferenceGrid />

    </TresCanvas>
  </div>
</template>

<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import type { GamutPointCloudData } from '@/types/analysis'
import GamutPointCloud from './GamutPointCloud.vue'
import GamutReferenceGrid from './GamutReferenceGrid.vue'

defineProps<{
  pointCloudData: GamutPointCloudData | null
}>()
</script>
