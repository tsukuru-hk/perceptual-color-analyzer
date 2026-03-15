<template>
  <div class="space-y-6">
    <Tabs default-value="original">
      <TabsList>
        <TabsTrigger value="original">元画像</TabsTrigger>
        <TabsTrigger value="chroma">彩度マップ</TabsTrigger>
      </TabsList>
      <TabsContent value="original">
        <ImageCanvas
          :image-data="imageData!"
          :on-canvas-click="onCanvasClick"
        />
      </TabsContent>
      <TabsContent value="chroma">
        <ChromaMapPanel :image-data="imageData!" />
        <Legend
          class="mt-3 max-w-md"
          title="Chroma (彩度)"
          min-label="0 (無彩色)"
          max-label="0.4+ (高彩度)"
          gradient="linear-gradient(to right, #000, #666, #fff)"
        />
      </TabsContent>
    </Tabs>

    <Card v-if="pixelOklch" class="max-w-lg">
      <CardHeader>
        <CardTitle>選択ピクセル OKLCH</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="flex items-start gap-5">
          <ColorSwatch :color="oklchCssColor" size="lg" rounded />
          <div class="flex-1 space-y-3">
            <ColorValueRow label="L" :value="pixelOklch.lightness" :max="1" color="#64748b" />
            <ColorValueRow label="C" :value="pixelOklch.chroma" :max="0.4" color="#22c55e" />
            <ColorValueRow label="h" :value="pixelOklch.hue" :max="360" unit="°" :precision="2" color="#3b82f6" />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { OklchValue } from '@/domain/oklch'
import { getPixelOklchUseCase } from '@/application/useCase/getPixelOklchUseCase'
import { useToast } from '@/composables/useToast'
import { useImageStore } from '@/composables/useImageStore'
import { Card, CardHeader, CardTitle, CardContent, Tabs, TabsList, TabsTrigger, TabsContent, ColorSwatch, ColorValueRow, Legend } from '@/components/ui'
import ImageCanvas from './ImageCanvas.vue'
import { ChromaMapPanel } from '@/features/grayscale-map'

const { toast } = useToast()
const store = useImageStore()
const imageData = computed(() => store.imageData.value)

const pixelOklch = ref<OklchValue | null>(null)

const oklchCssColor = computed(() => {
  const v = pixelOklch.value
  if (!v) return 'transparent'
  return `oklch(${v.lightness} ${v.chroma} ${v.hue})`
})

function onCanvasClick(clickedX: number, clickedY: number) {
  const data = imageData.value
  if (!data) return

  const result = getPixelOklchUseCase(data, clickedX, clickedY)
  if (result.isFailure()) {
    toast({ title: 'ピクセル取得エラー', description: result.error.message, variant: 'error' })
    pixelOklch.value = null
    return
  }
  pixelOklch.value = result.value
}
</script>
