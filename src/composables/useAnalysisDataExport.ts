import { ref } from 'vue'
import { useImageStore } from '@/composables/useImageStore'
import { useToast } from '@/composables/useToast'
import { buildDataExportFileName } from '@/domain/exportFileName'
import { triggerBlobDownload } from '@/infrastructure/fileDownload'

/** ダウンロードするテキストデータ（本文・MIME・拡張子） */
export interface DataExportPayload {
  readonly text: string
  readonly mime: string
  readonly ext: string
}

/**
 * 分析データ（AI が一次データに触れるための CSV / JSON）をダウンロードする共通フロー。
 * PNG 版（useAnalysisPngExport）と対を成し、画像 DL とは別系統。
 * - 選択中画像の名前から拡張子付きファイル名を生成する
 * - 失敗時はトーストで通知する
 * - `isExporting` で二重起動を防ぐ（UI の disabled にも流用可）
 */
export function useAnalysisDataExport() {
  const { selectedImage } = useImageStore()
  const { toast } = useToast()
  const isExporting = ref(false)

  /**
   * ファイル名を解決し、`build` が返したテキストをダウンロードする。
   * @param suffix ファイル名の接尾辞（`DATA_EXPORT_SUFFIX` のいずれか）
   * @param build ダウンロード対象（本文・MIME・拡張子）を返す関数。
   *              対象が未取得なら `null` を返すこと（その場合は中止）。
   */
  function exportData(suffix: string, build: () => DataExportPayload | null): void {
    if (isExporting.value) return

    const fileName = selectedImage.value?.fileName
    if (!fileName) {
      console.warn('[useAnalysisDataExport] 選択中の画像がないためエクスポートを中止しました')
      return
    }

    isExporting.value = true
    try {
      const payload = build()
      if (payload == null) {
        console.warn('[useAnalysisDataExport] 出力対象が取得できないためエクスポートを中止しました')
        return
      }
      const blob = new Blob([payload.text], { type: payload.mime })
      triggerBlobDownload(blob, buildDataExportFileName(fileName, suffix, payload.ext))
    } catch (e) {
      toast({
        title: 'データのダウンロードに失敗しました',
        description: e instanceof Error ? e.message : String(e),
        variant: 'error',
      })
    } finally {
      isExporting.value = false
    }
  }

  return { exportData, isExporting }
}
