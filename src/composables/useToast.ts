import { ref, type Ref } from 'vue'

/** 画面上に積むトースト1件分のデータ */
export interface ToastItem {
  id: string
  title: string
  description?: string
  variant: 'default' | 'success' | 'error' | 'info'
}

const toasts: Ref<ToastItem[]> = ref([])
let counter = 0

/**
 * グローバル通知（トースト）の表示キュー。
 * `Toaster` が `toasts` を購読して描画する。
 */
export function useToast() {
  /**
   * トーストを追加し、一定時間後に自動で閉じる。
   * @param opts タイトル・説明・種別。`duration` はミリ秒（省略時 4000）
   */
  function toast(opts: Omit<ToastItem, 'id'> & { duration?: number }) {
    const id = `toast-${++counter}`
    const item: ToastItem = {
      id,
      title: opts.title,
      description: opts.description,
      variant: opts.variant ?? 'default',
    }
    toasts.value.push(item)
    setTimeout(() => dismiss(id), opts.duration ?? 4000)
  }

  /** 指定 ID のトーストを手動で閉じる。 */
  function dismiss(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { toasts, toast, dismiss }
}
