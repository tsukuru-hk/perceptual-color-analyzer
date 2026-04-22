/**
 * 3D ガマットのブラシ操作に関する状態管理。
 * - 全体点群の表示/非表示
 * - ブラシモードの ON/OFF
 * - ブラシで蓄積されたポイントの管理
 */
import { ref, shallowRef, readonly } from 'vue'
import type { GamutPointCloudData } from '@/types/analysis'

/** ブラシポイントのプール初期容量 */
const INITIAL_CAPACITY = 5_000

/** ブラシポイントの上限 */
const MAX_BRUSH_POINTS = 50_000

function createEmptyCloudData(capacity: number): GamutPointCloudData {
  return {
    positions: new Float32Array(capacity * 3),
    colors: new Float32Array(capacity * 3),
    count: 0,
    totalPixels: 0,
  }
}

export function useGamutBrush() {
  const showBulkCloud = ref(true)
  const brushMode = ref(false)

  /** 現在のブラシポイントデータ（プールベース） */
  const brushData = shallowRef<GamutPointCloudData>(createEmptyCloudData(INITIAL_CAPACITY))

  /** 現在のプール容量 */
  let capacity = INITIAL_CAPACITY

  /**
   * ブラシポイントを追加する。
   * 容量超過時はプールを倍に拡張する。
   */
  function addBrushPoints(
    positions: Float32Array,
    colors: Float32Array,
    count: number,
  ): void {
    const current = brushData.value
    const newCount = current.count + count

    if (newCount > MAX_BRUSH_POINTS) return

    // 容量が足りなければ newCount 以上になるまで拡張
    if (newCount > capacity) {
      let newCapacity = capacity
      while (newCapacity < newCount) newCapacity *= 2
      newCapacity = Math.min(newCapacity, MAX_BRUSH_POINTS)
      const newPositions = new Float32Array(newCapacity * 3)
      const newColors = new Float32Array(newCapacity * 3)
      newPositions.set(current.positions.subarray(0, current.count * 3))
      newColors.set(current.colors.subarray(0, current.count * 3))
      capacity = newCapacity

      // 追加分をコピー
      newPositions.set(positions.subarray(0, count * 3), current.count * 3)
      newColors.set(colors.subarray(0, count * 3), current.count * 3)

      brushData.value = {
        positions: newPositions,
        colors: newColors,
        count: newCount,
        totalPixels: 0,
      }
      return
    }

    // 既存バッファに追加（新しいオブジェクトで reactivity をトリガー）
    const pos = new Float32Array(current.positions.length)
    pos.set(current.positions)
    pos.set(positions.subarray(0, count * 3), current.count * 3)

    const col = new Float32Array(current.colors.length)
    col.set(current.colors)
    col.set(colors.subarray(0, count * 3), current.count * 3)

    brushData.value = {
      positions: pos,
      colors: col,
      count: newCount,
      totalPixels: 0,
    }
  }

  /** ブラシポイントを全消去 */
  function clearBrushPoints(): void {
    capacity = INITIAL_CAPACITY
    brushData.value = createEmptyCloudData(INITIAL_CAPACITY)
  }

  /** ブラシモードをトグル */
  function toggleBrushMode(): void {
    brushMode.value = !brushMode.value
  }

  /** 全体点群表示をトグル */
  function toggleBulkCloud(): void {
    showBulkCloud.value = !showBulkCloud.value
  }

  return {
    showBulkCloud: readonly(showBulkCloud),
    brushMode: readonly(brushMode),
    brushData: readonly(brushData),

    addBrushPoints,
    clearBrushPoints,
    toggleBrushMode,
    toggleBulkCloud,
  }
}

export type GamutBrushContext = ReturnType<typeof useGamutBrush>
