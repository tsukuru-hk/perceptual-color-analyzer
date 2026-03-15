<template>
  <div class="space-y-10">
    <div>
      <h1 class="text-2xl font-bold text-foreground">デザインシステム</h1>
      <p class="mt-1 text-sm text-muted-foreground">再利用可能なコンポーネント一覧</p>
    </div>

    <!-- Colors -->
    <section>
      <h2 class="text-lg font-semibold text-foreground mb-4">カラーパレット</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <div v-for="color in colors" :key="color.name" class="space-y-1.5">
          <div :class="cn('h-16 rounded-xl border border-border', color.bg)" />
          <p class="text-xs font-medium text-foreground">{{ color.name }}</p>
          <p class="text-xs text-muted-foreground">{{ color.value }}</p>
        </div>
      </div>
    </section>

    <!-- Buttons -->
    <section>
      <h2 class="text-lg font-semibold text-foreground mb-4">Button</h2>
      <Card class="p-6">
        <div class="flex flex-wrap items-center gap-3">
          <Button variant="default">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="success">Success</Button>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon"><Plus class="h-4 w-4" /></Button>
        </div>
      </Card>
    </section>

    <!-- Badges -->
    <section>
      <h2 class="text-lg font-semibold text-foreground mb-4">Badge</h2>
      <Card class="p-6">
        <div class="flex flex-wrap items-center gap-3">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">+25%</Badge>
          <Badge variant="destructive">-12%</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </Card>
    </section>

    <!-- Cards -->
    <section>
      <h2 class="text-lg font-semibold text-foreground mb-4">Card</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle>Followers</CardTitle>
              <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
                <Users class="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p class="text-3xl font-bold text-foreground">128,420</p>
            <Badge variant="success" class="mt-2">+25%</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle>Likes</CardTitle>
              <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100">
                <Heart class="h-4 w-4 text-red-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p class="text-3xl font-bold text-foreground">66,816</p>
            <Badge variant="success" class="mt-2">+32%</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle>Click-through Rate</CardTitle>
              <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
                <MousePointerClick class="h-4 w-4 text-amber-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p class="text-3xl font-bold text-foreground">2,420</p>
            <Badge variant="success" class="mt-2">+28%</Badge>
          </CardContent>
        </Card>
      </div>
    </section>

    <!-- DropZone -->
    <section>
      <h2 class="text-lg font-semibold text-foreground mb-4">DropZone</h2>
      <Card class="p-6">
        <DropZone accept="image/*" @file-selected="onDemoFileSelected" />
      </Card>
    </section>

    <!-- Tabs -->
    <section>
      <h2 class="text-lg font-semibold text-foreground mb-4">Tabs</h2>
      <Card class="p-6">
        <Tabs default-value="tab1">
          <TabsList>
            <TabsTrigger value="tab1">概要</TabsTrigger>
            <TabsTrigger value="tab2">詳細</TabsTrigger>
            <TabsTrigger value="tab3">設定</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <p class="text-sm text-muted-foreground">概要タブの内容がここに表示されます。</p>
          </TabsContent>
          <TabsContent value="tab2">
            <p class="text-sm text-muted-foreground">詳細タブの内容がここに表示されます。</p>
          </TabsContent>
          <TabsContent value="tab3">
            <p class="text-sm text-muted-foreground">設定タブの内容がここに表示されます。</p>
          </TabsContent>
        </Tabs>
      </Card>
    </section>

    <!-- Toggle -->
    <section>
      <h2 class="text-lg font-semibold text-foreground mb-4">Toggle</h2>
      <Card class="p-6 space-y-4">
        <Toggle v-model="toggleA" label="クロスヘア表示" description="Canvas 上にクロスヘアカーソルを表示します" />
        <Toggle v-model="toggleB" label="オーバーレイ" />
      </Card>
    </section>

    <!-- Slider -->
    <section>
      <h2 class="text-lg font-semibold text-foreground mb-4">Slider</h2>
      <Card class="p-6 space-y-6">
        <Slider v-model="sliderA" :min="0" :max="100" :step="1" label="サンプリング密度" />
        <Slider v-model="sliderB" :min="0" :max="360" :step="1" label="色相角度" />
      </Card>
    </section>

    <!-- ColorSwatch -->
    <section>
      <h2 class="text-lg font-semibold text-foreground mb-4">ColorSwatch</h2>
      <Card class="p-6">
        <div class="flex items-end gap-4">
          <div class="space-y-1 text-center">
            <ColorSwatch color="oklch(0.7 0.15 150)" size="lg" />
            <p class="text-xs text-muted-foreground">Large</p>
          </div>
          <div class="space-y-1 text-center">
            <ColorSwatch color="#3b82f6" size="md" rounded />
            <p class="text-xs text-muted-foreground">Rounded</p>
          </div>
          <div class="space-y-1 text-center">
            <ColorSwatch color="oklch(0.8 0.2 30)" size="sm" />
            <p class="text-xs text-muted-foreground">Small</p>
          </div>
          <div class="space-y-1 text-center">
            <ColorSwatch color="#ef4444" size="md" />
            <p class="text-xs text-muted-foreground">Hex</p>
          </div>
          <div class="space-y-1 text-center">
            <ColorSwatch color="oklch(0.5 0.3 270)" size="md" rounded />
            <p class="text-xs text-muted-foreground">OKLCH</p>
          </div>
        </div>
      </Card>
    </section>

    <!-- ColorValueRow -->
    <section>
      <h2 class="text-lg font-semibold text-foreground mb-4">ColorValueRow</h2>
      <Card class="p-6 max-w-lg space-y-3">
        <ColorValueRow label="L" :value="0.7234" :max="1" color="#64748b" />
        <ColorValueRow label="C" :value="0.1456" :max="0.4" color="#22c55e" />
        <ColorValueRow label="h" :value="152.34" :max="360" unit="°" :precision="2" color="#3b82f6" />
      </Card>
    </section>

    <!-- Legend -->
    <section>
      <h2 class="text-lg font-semibold text-foreground mb-4">Legend</h2>
      <Card class="p-6 space-y-6 max-w-md">
        <Legend
          title="Lightness (明度)"
          min-label="0 (黒)"
          max-label="1 (白)"
          gradient="linear-gradient(to right, #000, #fff)"
        />
        <Legend
          title="Chroma (彩度)"
          min-label="0 (無彩色)"
          max-label="0.4+ (高彩度)"
          gradient="linear-gradient(to right, #888, oklch(0.7 0.15 150), oklch(0.7 0.35 150))"
        />
        <Legend
          title="Hue (色相)"
          min-label="0°"
          max-label="360°"
          gradient="linear-gradient(to right, oklch(0.7 0.2 0), oklch(0.7 0.2 60), oklch(0.7 0.2 120), oklch(0.7 0.2 180), oklch(0.7 0.2 240), oklch(0.7 0.2 300), oklch(0.7 0.2 360))"
        />
      </Card>
    </section>

    <!-- Tooltip -->
    <section>
      <h2 class="text-lg font-semibold text-foreground mb-4">Tooltip</h2>
      <Card class="p-6">
        <div class="flex flex-wrap items-center gap-3">
          <Tooltip content="上に表示" side="top">
            <Button variant="outline">Top</Button>
          </Tooltip>
          <Tooltip content="右に表示" side="right">
            <Button variant="outline">Right</Button>
          </Tooltip>
          <Tooltip content="下に表示" side="bottom">
            <Button variant="outline">Bottom</Button>
          </Tooltip>
          <Tooltip content="左に表示" side="left">
            <Button variant="outline">Left</Button>
          </Tooltip>
        </div>
      </Card>
    </section>

    <!-- Toast -->
    <section>
      <h2 class="text-lg font-semibold text-foreground mb-4">Toast</h2>
      <Card class="p-6">
        <div class="flex flex-wrap items-center gap-3">
          <Button @click="toast({ title: '保存しました', variant: 'success' })">Success Toast</Button>
          <Button variant="destructive" @click="toast({ title: 'エラーが発生しました', description: 'ファイルを読み込めませんでした', variant: 'error' })">Error Toast</Button>
          <Button variant="secondary" @click="toast({ title: 'ヒント', description: 'ピクセルをクリックすると OKLCH 値が表示されます', variant: 'info' })">Info Toast</Button>
        </div>
      </Card>
    </section>

    <!-- ChartContainer -->
    <section>
      <h2 class="text-lg font-semibold text-foreground mb-4">ChartContainer</h2>
      <ChartContainer title="明度分布ヒストグラム" description="画像内の全ピクセルの L 値分布">
        <div class="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground">
          D3 チャートのプレースホルダ
        </div>
      </ChartContainer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Users, Heart, MousePointerClick, Plus } from 'lucide-vue-next'
import {
  Button, Card, CardHeader, CardTitle, CardContent, Badge,
  DropZone, Tabs, TabsList, TabsTrigger, TabsContent,
  Toggle, Slider, ColorSwatch, ColorValueRow, Legend,
  Tooltip, ChartContainer,
} from '@/components/ui'
import { useToast } from '@/composables/useToast'
import { cn } from '@/lib/utils'

const { toast } = useToast()

const toggleA = ref(true)
const toggleB = ref(false)
const sliderA = ref(50)
const sliderB = ref(180)

function onDemoFileSelected(file: File) {
  toast({ title: `${file.name} を選択しました`, variant: 'success' })
}

const colors = [
  { name: 'Primary', value: '#3b82f6', bg: 'bg-primary' },
  { name: 'Secondary', value: '#f1f5f9', bg: 'bg-secondary' },
  { name: 'Accent', value: '#d9f99d', bg: 'bg-accent' },
  { name: 'Success', value: '#22c55e', bg: 'bg-success' },
  { name: 'Destructive', value: '#ef4444', bg: 'bg-destructive' },
  { name: 'Muted', value: '#f1f5f9', bg: 'bg-muted' },
  { name: 'Background', value: '#f8fafc', bg: 'bg-background' },
  { name: 'Foreground', value: '#0f172a', bg: 'bg-foreground' },
  { name: 'Card', value: '#ffffff', bg: 'bg-card' },
  { name: 'Border', value: '#e2e8f0', bg: 'bg-border' },
  { name: 'Ring', value: '#3b82f6', bg: 'bg-ring' },
  { name: 'Muted FG', value: '#64748b', bg: 'bg-muted-foreground' },
]
</script>
