/**
 * 3D ガマットの表示モード管理とブラシ点群の蓄積。
 *
 * - 全体モード: 画像全体からサンプリングした点群を表示
 * - ブラシモード: 画像上をドラッグして点を追加
 * - 画像ごとにブラシデータ・モードを保持（LRU で上限 {@link MAX_CACHED_IMAGES} 枚）
 * - バッファは最大容量で 1 度だけ確保し、以後は再利用する（O(N) 挿入）
 */
import { ref, shallowRef, readonly, computed, watch, triggerRef, type Ref } from 'vue'
import type { GamutPointCloudData } from '@/types/analysis'

/** ブラシモード/全体モードの識別子 */
export type GamutMode = 'bulk' | 'brush'

/**
 * ブラシポイントの上限。
 * {@link GamutBrushCloud} の InstancedMesh 容量もこの値に揃える。
 */
export const MAX_BRUSH_POINTS = 20_000

/** 画像ごとに保持する状態の最大数（LRU） */
const MAX_CACHED_IMAGES = 8

/** 画像ごとのブラシ状態 */
interface PerImageState {
  /** 最大容量で確保した位置バッファ（[x,y,z,...]） */
  positions: Float32Array
  /** 最大容量で確保した色バッファ（[r,g,b,...]） */
  colors: Float32Array
  /** 現在有効な点数 */
  count: number
  /** 選択モード */
  mode: GamutMode
}

function createEmptyState(): PerImageState {
  return {
    positions: new Float32Array(MAX_BRUSH_POINTS * 3),
    colors: new Float32Array(MAX_BRUSH_POINTS * 3),
    count: 0,
    mode: 'bulk',
  }
}

/** 永続化せずに返す空データのシングルトン（新規画像の初期表示用） */
const EMPTY_DATA: GamutPointCloudData = {
  positions: new Float32Array(0),
  colors: new Float32Array(0),
  count: 0,
  totalPixels: 0,
}

/**
 * ガマット 3D のブラシ/全体モードを制御する composable。
 *
 * @param imageId 選択中の画像 ID（空文字なら未選択）
 * @returns ビューから利用する reactive 値と操作関数
 */
export function useGamutBrush(imageId: Ref<string>) {
  /** 画像 ID → ブラシ状態のキャッシュ（挿入順＝LRU） */
  const stateMap = new Map<string, PerImageState>()

  /** LRU: 最近アクセスした順に末尾へ移す */
  function touch(id: string, state: PerImageState): void {
    stateMap.delete(id)
    stateMap.set(id, state)
    // 上限超過時は最古の状態から削除
    while (stateMap.size > MAX_CACHED_IMAGES) {
      const oldestKey = stateMap.keys().next().value
      if (oldestKey === undefined || oldestKey === id) break
      stateMap.delete(oldestKey)
    }
  }

  function getOrCreateState(id: string): PerImageState {
    let state = stateMap.get(id)
    if (!state) {
      state = createEmptyState()
    }
    touch(id, state)
    return state
  }

  const mode = ref<GamutMode>('bulk')
  /** 現在画像のブラシデータを表す reactive 値 */
  const brushData = shallowRef<GamutPointCloudData>(EMPTY_DATA)

  const isBrush = computed(() => mode.value === 'brush')

  /** 現在の画像状態を `brushData` に反映する */
  function refreshBrushData(state: PerImageState): void {
    brushData.value = {
      positions: state.positions,
      colors: state.colors,
      count: state.count,
      totalPixels: 0,
    }
  }

  /** 指定画像の状態をリアクティブ値に復元（画像切替時に呼ぶ） */
  function loadImage(id: string): void {
    if (!id) {
      mode.value = 'bulk'
      brushData.value = EMPTY_DATA
      return
    }
    const state = getOrCreateState(id)
    mode.value = state.mode
    refreshBrushData(state)
  }

  /* ---------- 画像切替（ドラッグ中はストローク終了まで待つ） ---------- */

  /** ドラッグ中に画像切替が来たら保留する */
  let pendingImageId: string | null = null
  /** ストローク中は true。画像切替・状態復元をブロックする */
  let strokeActive = false
  /** ストローク開始時にキャプチャした imageId（途中で画像が変わっても保持） */
  let strokeImageId = ''

  watch(imageId, (newId) => {
    if (strokeActive) {
      pendingImageId = newId
      return
    }
    loadImage(newId)
  })

  // 初期化
  loadImage(imageId.value)

  /* ---------- 公開 API ---------- */

  /** ストローク開始を宣言する（画像切替を一時的にブロック） */
  function beginStroke(): void {
    strokeActive = true
    strokeImageId = imageId.value
  }

  /** ストローク終了を宣言する。保留されていた画像切替があれば適用 */
  function endStroke(): void {
    strokeActive = false
    strokeImageId = ''
    const pending = pendingImageId
    pendingImageId = null
    if (pending != null) loadImage(pending)
  }

  /**
   * モードを切り替える。
   *
   * @param next 新しいモード
   * @remarks `brush` に遷移するときはブラシ点を 0 に戻す
   */
  function setMode(next: GamutMode): void {
    if (mode.value === next) return
    if (next === 'brush') {
      clearBrushPoints()
    }
    mode.value = next
    const state = stateMap.get(imageId.value)
    if (state) state.mode = next
  }

  /**
   * ブラシポイントを追加する。
   *
   * ストローク中に画像が切り替わっても、開始時にキャプチャした imageId の状態へ追記する。
   * 上限に達した場合は {@link onLimitReached} を呼び出して false を返す。
   *
   * @param positions 追加する位置データ（長さ >= count * 3）
   * @param colors 追加する色データ（長さ >= count * 3）
   * @param count 追加点数
   * @returns 正常に追加できたら true、上限到達/画像未選択で弾いたら false
   */
  function addBrushPoints(
    positions: Float32Array,
    colors: Float32Array,
    count: number,
  ): boolean {
    const targetId = strokeActive ? strokeImageId : imageId.value
    if (!targetId) return false

    const state = getOrCreateState(targetId)
    const newCount = state.count + count

    if (newCount > MAX_BRUSH_POINTS) {
      onLimitReached?.()
      return false
    }

    const offset = state.count * 3
    state.positions.set(positions.subarray(0, count * 3), offset)
    state.colors.set(colors.subarray(0, count * 3), offset)
    state.count = newCount

    // 対象が現在表示中の画像なら brushData を更新して再レンダー
    if (targetId === imageId.value) {
      // バッファ参照は同じなので、count だけ更新した wrapper で再通知
      refreshBrushData(state)
      triggerRef(brushData)
    }
    return true
  }

  /** 現在画像のブラシポイントを全消去する */
  function clearBrushPoints(): void {
    const id = imageId.value
    if (!id) return
    const state = getOrCreateState(id)
    state.count = 0
    refreshBrushData(state)
  }

  /** 指定画像の状態を破棄する（useImageStore.removeImage と連動させる想定） */
  function forgetImage(id: string): void {
    stateMap.delete(id)
    if (id === imageId.value) {
      mode.value = 'bulk'
      brushData.value = EMPTY_DATA
    }
  }

  /* ---------- 上限到達ハンドラ ---------- */

  let onLimitReached: (() => void) | undefined

  /**
   * ブラシ点が上限に達したときのコールバックを登録する。
   * UI 層でトーストを出すなどに使う。
   */
  function setOnLimitReached(handler: (() => void) | undefined): void {
    onLimitReached = handler
  }

  return {
    mode: readonly(mode),
    isBrush,
    /**
     * 現在画像のブラシ点群。`GamutPointCloudData` の readonly フィールドを尊重し、
     * 呼び出し側での `.value = ...` による書き換えは避けること（変更は
     * `addBrushPoints`/`clearBrushPoints` 経由で行う）。
     */
    brushData,

    setMode,
    addBrushPoints,
    clearBrushPoints,
    beginStroke,
    endStroke,
    forgetImage,
    setOnLimitReached,
  }
}
