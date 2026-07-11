import { onMounted, onBeforeUnmount } from 'vue'

/**
 * クリップボードにコピー・スクショされた画像を貼り付け（Cmd/Ctrl+V）で受け取り、
 * コールバックへファイルとして渡す。
 *
 * - テキスト入力中の貼り付けを奪わないよう、編集可能要素にフォーカスがある場合は無視する。
 * - 画像アイテムを含まない paste（テキストのみ等）は素通しする。
 * - スクショ等で名前が空のファイルには拡張子付きの既定名を補う（ギャラリー表示・保存名のため）。
 *
 * @param onImages 画像ファイルが1件以上取り出せたときに呼ばれる。配列長は常に1以上。
 */
export function usePasteImage(onImages: (files: File[]) => void): void {
  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    const tag = target.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
  }

  /** 名前が空のファイル（スクショ等）に MIME から導いた既定名を付ける。 */
  function toNamedFile(file: File): File {
    if (file.name) return file
    const ext = file.type.split('/')[1] || 'png'
    return new File([file], `pasted-image.${ext}`, { type: file.type })
  }

  function onPaste(event: ClipboardEvent): void {
    if (isEditableTarget(event.target)) return

    const items = event.clipboardData?.items
    if (!items) return

    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item && item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) files.push(toNamedFile(file))
      }
    }
    if (files.length === 0) return

    event.preventDefault()
    onImages(files)
  }

  onMounted(() => window.addEventListener('paste', onPaste))
  onBeforeUnmount(() => window.removeEventListener('paste', onPaste))
}
