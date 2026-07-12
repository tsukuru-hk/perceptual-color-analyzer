/**
 * Blob をファイルとしてブラウザにダウンロードさせる共通処理。
 * Infrastructure: ブラウザ API（Blob, URL, a 要素）に依存する。
 */

/**
 * Blob を指定ファイル名でダウンロードさせる（一時 a 要素のクリック）。
 * @param blob 保存するデータ
 * @param filename 保存ファイル名
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
