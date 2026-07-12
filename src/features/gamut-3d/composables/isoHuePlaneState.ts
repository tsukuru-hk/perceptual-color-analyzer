import { ref } from 'vue'
import { Vector3 } from 'three'

/**
 * 「等色相面モード」の共有状態。
 * 真横（水平から±3°以内）ビューのとき、見えている鉛直面＝等色相面に載る点だけを表示する。
 * ガイド（カメラ追従で面法線を更新）・点群（シェーダでフィルタ）・シーン（トグルUI）で共有する。
 */

/** 真横±3°以内で、等色相面モードを利用できるか */
export const isoHueAvailable = ref(false)
/** 等色相面モードが ON か */
export const isoHueEnabled = ref(false)

/** 等色相面（L軸を含む鉛直面）の水平な法線。毎フレーム in-place で更新する。 */
export const isoPlaneNormal = new Vector3(0, 0, 1)

/** 面からの許容垂直距離（ワールド単位）。少し幅を持たせて点が消えすぎないようにする。 */
export const ISO_BAND = 0.27

/**
 * 利用可否を更新する。利用不可（±3°の範囲外）になったら等色相面モードは必ず解除する。
 */
export function setIsoHueAvailable(available: boolean): void {
  if (isoHueAvailable.value === available) return
  isoHueAvailable.value = available
  if (!available) isoHueEnabled.value = false
}

/** モードのオン/オフを切り替える（利用可能なときのみ有効） */
export function toggleIsoHue(): void {
  if (!isoHueAvailable.value) return
  isoHueEnabled.value = !isoHueEnabled.value
}
