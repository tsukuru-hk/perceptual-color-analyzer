import { ref, type Ref } from 'vue'

export interface ToastItem {
  id: string
  title: string
  description?: string
  variant: 'default' | 'success' | 'error' | 'info'
}

const toasts: Ref<ToastItem[]> = ref([])
let counter = 0

export function useToast() {
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

  function dismiss(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { toasts, toast, dismiss }
}
