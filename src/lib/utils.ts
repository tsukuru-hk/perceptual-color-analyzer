import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tailwind のクラス文字列をマージする（競合時は後勝ち）。
 * @param inputs `clsx` に渡すクラス値の可変長引数
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
