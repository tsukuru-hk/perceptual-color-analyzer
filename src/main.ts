/**
 * エントリ：Vue アプリ生成、スタイル・ルータ適用、`#app` へマウント。
 */
import { createApp } from 'vue'
import '@/assets/css/tailwind.css'
import App from './App.vue'
import router from './router'
import { useToast } from '@/composables/useToast'

const app = createApp(App)

// --- グローバルエラーハンドラ ---
app.config.errorHandler = (err, _instance, info) => {
  console.error(`[Vue Error] ${info}:`, err)
  const { toast } = useToast()
  toast({
    title: '予期しないエラーが発生しました',
    description: err instanceof Error ? err.message : String(err),
    variant: 'error',
  })
}

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Unhandled Rejection]', e.reason)
  const { toast } = useToast()
  toast({
    title: '非同期処理でエラーが発生しました',
    description: e.reason instanceof Error ? e.reason.message : String(e.reason),
    variant: 'error',
  })
})

app.use(router).mount('#app')
