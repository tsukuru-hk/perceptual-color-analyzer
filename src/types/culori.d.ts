declare module 'culori' {
  export function oklch(
    color: string | { mode: 'rgb'; r: number; g: number; b: number }
  ): { mode: 'oklch'; l: number; c: number; h: number } | undefined
  export function formatHex(color: { mode: string; r: number; g: number; b: number }): string
}
