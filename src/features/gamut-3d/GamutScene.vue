<template>
  <div class="absolute inset-0">
    <GamutToolbar
      :show-bulk-cloud="showBulkCloud"
      :brush-mode="brushMode"
      :brush-point-count="brushData.count"
      @toggle-bulk="$emit('toggle-bulk')"
      @toggle-brush="$emit('toggle-brush')"
      @clear-brush="$emit('clear-brush')"
    />
    <TresCanvas v-if="isMounted" :clear-color="'#a0a0a0'">
      <TresPerspectiveCamera :position="[7, 5, 7]" :fov="20" />
      <OrbitControls
        :enable-damping="true"
        :damping-factor="0.08"
      />

      <GamutPointCloud v-if="showBulkCloud" :data="pointCloudData" />

      <GamutBrushCloud :data="brushData" />

      <GamutReferenceGrid :color-space="colorSpace" />

    </TresCanvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import type { GamutPointCloudData } from '@/types/analysis'
import type { ColorSpace } from '@/domain/colorSpace'
import GamutPointCloud from './GamutPointCloud.vue'
import GamutBrushCloud from './GamutBrushCloud.vue'
import GamutReferenceGrid from './GamutReferenceGrid.vue'
import GamutToolbar from './GamutToolbar.vue'

withDefaults(defineProps<{
  pointCloudData: GamutPointCloudData | null
  colorSpace?: ColorSpace
  showBulkCloud: boolean
  brushMode: boolean
  brushData: GamutPointCloudData
}>(), {
  colorSpace: 'srgb',
})

defineEmits<{
  'toggle-bulk': []
  'toggle-brush': []
  'clear-brush': []
}>()

const isMounted = ref(false)
onMounted(() => { isMounted.value = true })
</script>
