/**
 * 分析結果を PNG としてエクスポートし、ブラウザにダウンロードさせる。
 * Infrastructure: ブラウザ API（Canvas, Blob, SVG, a 要素）に依存する。
 */

import type { Result } from '@/core/result'
import { success, failure, BaseError } from '@/core/result'
import { triggerBlobDownload } from '@/infrastructure/fileDownload'

export type PngExportError = 'NoContext' | 'EncodeFailed' | 'SvgRenderFailed'

/** @param name エラー種別 @param message 表示用メッセージ */
function exportError(name: PngExportError, message: string): Result<void, PngExportError> {
  return failure(new BaseError<PngExportError>({ name, message }))
}

/** Canvas を PNG Blob 化する（失敗時は null） */
function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

/**
 * ImageData を PNG としてダウンロードする（Canvas2D 系: 明度・彩度グレースケール用）。
 * @param data 描画するピクセルバッファ
 * @param filename 保存ファイル名
 */
export async function exportImageDataAsPng(
  data: ImageData,
  filename: string,
): Promise<Result<void, PngExportError>> {
  const canvas = document.createElement('canvas')
  canvas.width = data.width
  canvas.height = data.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return exportError('NoContext', '2D コンテキストを取得できませんでした')
  ctx.putImageData(data, 0, 0)

  const blob = await canvasToPngBlob(canvas)
  if (!blob) return exportError('EncodeFailed', 'PNG への変換に失敗しました')
  triggerBlobDownload(blob, filename)
  return success(undefined)
}

/**
 * Canvas 要素をそのまま PNG としてダウンロードする（WebGL 3D 系: 色相 3D・ガマット 3D 用）。
 * 呼び出し側は `preserveDrawingBuffer` を有効にした Canvas を渡すこと。
 * @param canvas キャプチャ対象の Canvas
 * @param filename 保存ファイル名
 */
export async function exportCanvasAsPng(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<Result<void, PngExportError>> {
  const blob = await canvasToPngBlob(canvas)
  if (!blob) return exportError('EncodeFailed', 'PNG への変換に失敗しました')
  triggerBlobDownload(blob, filename)
  return success(undefined)
}

/**
 * SVG 要素をラスタライズして PNG としてダウンロードする（カラーバブル用）。
 * 表示サイズを基準に、`scale` 倍の解像度で書き出す。
 * @param svg 対象の SVG 要素
 * @param filename 保存ファイル名
 * @param scale 出力解像度の倍率（デフォルト 2 = 高精細）
 */
export async function exportSvgAsPng(
  svg: SVGSVGElement,
  filename: string,
  scale = 2,
): Promise<Result<void, PngExportError>> {
  const rect = svg.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))

  // 表示中の SVG を複製し、ラスタライズに必要な明示的サイズを与える
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.style.width = `${width}px`
  clone.style.height = `${height}px`

  const svgString = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const img = new Image()
  const loaded = await new Promise<boolean>((resolve) => {
    // onload/onerror のどちらも発火しない異常時に備えてタイムアウトで打ち切る
    const timer = setTimeout(() => resolve(false), 10000)
    img.onload = () => { clearTimeout(timer); resolve(true) }
    img.onerror = () => { clearTimeout(timer); resolve(false) }
    img.src = url
  })
  URL.revokeObjectURL(url)
  if (!loaded) return exportError('SvgRenderFailed', 'SVG の描画に失敗しました')

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return exportError('NoContext', '2D コンテキストを取得できませんでした')
  // 透過背景だと用途によって見づらいため白で塗りつぶす
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await canvasToPngBlob(canvas)
  if (!blob) return exportError('EncodeFailed', 'PNG への変換に失敗しました')
  triggerBlobDownload(blob, filename)
  return success(undefined)
}
