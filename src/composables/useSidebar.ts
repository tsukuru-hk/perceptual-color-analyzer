import { ref } from 'vue'

/**
 * サイドバーの開閉状態を管理するcomposable。
 * シングルトンとして全コンポーネントで状態を共有する。
 */
const isOpen = ref(true)

/** @returns 開閉状態と `toggle` / `open` / `close`（現状ナビ幅固定のため未使用も可） */
export function useSidebar() {
  function toggle() {
    isOpen.value = !isOpen.value
  }

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  return { isOpen, toggle, open, close }
}
