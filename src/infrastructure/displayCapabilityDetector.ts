/**
 * ディスプレイの色域能力と Canvas の色空間サポートを検出する。
 * Infrastructure: ブラウザ API（matchMedia, Canvas）に依存。
 */

import type { ColorSpace, DisplayGamut } from '@/domain/colorSpace'

/**
 * ユーザーのディスプレイが対応する色域を検出する。
 * CSS Media Queries Level 4 の color-gamut を使用。
 */
export function detectDisplayGamut(): DisplayGamut {
  if (typeof window === 'undefined' || !window.matchMedia) return 'srgb'
  if (window.matchMedia('(color-gamut: rec2020)').matches) return 'rec2020'
  if (window.matchMedia('(color-gamut: p3)').matches) return 'p3'
  return 'srgb'
}

/**
 * Canvas 2D コンテキストが display-p3 色空間をサポートするか検出する。
 */
export function canvasSupportsP3(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' })
    if (!ctx) return false
    // getContextAttributes が colorSpace: 'display-p3' を返すか確認
    const attrs = (ctx as unknown as { getContextAttributes?: () => { colorSpace?: string } })
      .getContextAttributes?.()
    return attrs?.colorSpace === 'display-p3'
  } catch {
    return false
  }
}

/**
 * ディスプレイ能力と Canvas サポートから、最適な作業色空間を決定する。
 * P3 ディスプレイ + Canvas P3 サポート の両方が揃った場合のみ display-p3 を使う。
 */
export function determineWorkingColorSpace(): ColorSpace {
  const gamut = detectDisplayGamut()
  if ((gamut === 'p3' || gamut === 'rec2020') && canvasSupportsP3()) {
    return 'display-p3'
  }
  return 'srgb'
}
