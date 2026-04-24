/// <reference lib="webworker" />

/**
 * 地形ジオメトリの頂点座標・カラー配列を Worker で計算する。
 * Three.js 非依存 — 純粋な数値演算のみ。
 */

declare const self: DedicatedWorkerGlobalScope

// === プロトコル ===
export interface TerrainWorkerRequest {
  id: number
  type: 'terrain' | 'refGrid'
  // 共通パラメータ
  hueBinCount: number
  chromaBinCount: number
  wheelColors: ArrayLike<number> // flat [r,g,b, r,g,b, ...] (0-255)
  gamutMaxChroma: ArrayLike<number>
  maxChroma: number
  densityCells: ReadonlyArray<{ hueBin: number; chromaBin: number; density: number }>
  logScale: boolean
  activeBand: 'all' | 'dark' | 'mid' | 'light'
  // terrain 用
  angularSegments?: number
  radialSegments?: number
  terrainRadius?: number
  heightScale?: number
}

export interface TerrainWorkerResponse {
  id: number
  type: 'terrain' | 'refGrid'
  positions: Float32Array
  colors: Float32Array
  // refGrid 用
  dotPositions?: Float32Array
  dotColors?: Float32Array
}

// === 色変換ユーティリティ（Three.js 非依存） ===

/** sRGB → Linear */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Linear → sRGB */
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/** Linear RGB → HSL (Three.js Color.getHSL 互換) */
function linearRgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  // Three.js の getHSL は SRGBColorSpace 指定時、内部的に linear→sRGB 変換してから HSL 計算する
  const sr = linearToSrgb(r)
  const sg = linearToSrgb(g)
  const sb = linearToSrgb(b)

  const max = Math.max(sr, sg, sb)
  const min = Math.min(sr, sg, sb)
  const l = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === sr) h = (sg - sb) / d + (sg < sb ? 6 : 0)
  else if (max === sg) h = (sb - sr) / d + 2
  else h = (sr - sg) / d + 4
  h /= 6

  return { h, s, l }
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

/** HSL → Linear RGB (Three.js Color.setHSL 互換) */
function hslToLinearRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let sr: number, sg: number, sb: number
  if (s === 0) {
    sr = sg = sb = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    sr = hue2rgb(p, q, h + 1 / 3)
    sg = hue2rgb(p, q, h)
    sb = hue2rgb(p, q, h - 1 / 3)
  }
  // sRGB → Linear
  return { r: srgbToLinear(sr), g: srgbToLinear(sg), b: srgbToLinear(sb) }
}

/** Linear RGB 同士の lerp */
function lerpColor(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  t: number,
): { r: number; g: number; b: number } {
  return {
    r: r1 + (r2 - r1) * t,
    g: g1 + (g2 - g1) * t,
    b: b1 + (b2 - b1) * t,
  }
}

// === 計算ロジック ===

function sampleGamutMaxChroma(gamutMaxChroma: ArrayLike<number>, hueNorm: number): number {
  const n = gamutMaxChroma.length
  const hf = hueNorm * n
  const h0 = Math.floor(hf) % n
  const h1 = (h0 + 1) % n
  const t = hf - Math.floor(hf)
  return gamutMaxChroma[h0]! * (1 - t) + gamutMaxChroma[h1]! * t
}

function gamutRadiusAt(gamutMaxChroma: ArrayLike<number>, globalMaxC: number, hueNorm: number, terrainRadius: number): number {
  if (globalMaxC === 0) return terrainRadius
  return (sampleGamutMaxChroma(gamutMaxChroma, hueNorm) / globalMaxC) * terrainRadius
}

function buildDensityGrid(cells: ReadonlyArray<{ hueBin: number; chromaBin: number; density: number }>, hueBins: number, chromaBins: number): Float32Array {
  const grid = new Float32Array(hueBins * chromaBins)
  for (const cell of cells) {
    grid[cell.hueBin * chromaBins + cell.chromaBin] = cell.density
  }
  return grid
}

function sampleDensity(grid: Float32Array, hueBins: number, chromaBins: number, hueNorm: number, chromaNorm: number): number {
  const hf = hueNorm * hueBins
  const cf = chromaNorm * chromaBins
  const h0 = Math.floor(hf) % hueBins
  const h1 = (h0 + 1) % hueBins
  const c0 = Math.min(Math.floor(cf), chromaBins - 1)
  const c1 = Math.min(c0 + 1, chromaBins - 1)
  const ht = hf - Math.floor(hf)
  const ct = cf - Math.floor(cf)
  const v0 = grid[h0 * chromaBins + c0]! * (1 - ht) + grid[h1 * chromaBins + c0]! * ht
  const v1 = grid[h0 * chromaBins + c1]! * (1 - ht) + grid[h1 * chromaBins + c1]! * ht
  return v0 * (1 - ct) + v1 * ct
}

function sampleWheelColor(wheelColors: ArrayLike<number>, hueBins: number, chromaBins: number, hueNorm: number, chromaNorm: number): { r: number; g: number; b: number } {
  const hf = hueNorm * hueBins
  const cf = chromaNorm * chromaBins
  const h0 = Math.floor(hf) % hueBins
  const h1 = (h0 + 1) % hueBins
  const c0 = Math.min(Math.floor(cf), chromaBins - 1)
  const c1 = Math.min(c0 + 1, chromaBins - 1)
  const ht = hf - Math.floor(hf)
  const ct = cf - Math.floor(cf)
  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t
  const i00 = (h0 * chromaBins + c0) * 3
  const i10 = (h1 * chromaBins + c0) * 3
  const i01 = (h0 * chromaBins + c1) * 3
  const i11 = (h1 * chromaBins + c1) * 3
  return {
    r: lerp(lerp(wheelColors[i00]!, wheelColors[i10]!, ht), lerp(wheelColors[i01]!, wheelColors[i11]!, ht), ct),
    g: lerp(lerp(wheelColors[i00 + 1]!, wheelColors[i10 + 1]!, ht), lerp(wheelColors[i01 + 1]!, wheelColors[i11 + 1]!, ht), ct),
    b: lerp(lerp(wheelColors[i00 + 2]!, wheelColors[i10 + 2]!, ht), lerp(wheelColors[i01 + 2]!, wheelColors[i11 + 2]!, ht), ct),
  }
}

function bandLightnessScale(band: string): number {
  switch (band) {
    case 'dark': return 0.45
    case 'mid': return 0.75
    case 'light': return 1.3
    default: return 1.0
  }
}

function bandBaseColorLinear(band: string): { r: number; g: number; b: number } {
  switch (band) {
    case 'dark': return { r: srgbToLinear(0.25), g: srgbToLinear(0.25), b: srgbToLinear(0.28) }
    case 'mid': return { r: srgbToLinear(0.6), g: srgbToLinear(0.6), b: srgbToLinear(0.62) }
    case 'light': return { r: srgbToLinear(0.95), g: srgbToLinear(0.95), b: srgbToLinear(0.95) }
    default: return { r: srgbToLinear(0.95), g: srgbToLinear(0.95), b: srgbToLinear(0.95) }
  }
}

/** sRGB (0-255) → Linear RGB + HSL 明度スケーリング → Linear RGB */
function processColor(r255: number, g255: number, b255: number, lScale: number): { r: number; g: number; b: number } {
  const lr = srgbToLinear(r255 / 255)
  const lg = srgbToLinear(g255 / 255)
  const lb = srgbToLinear(b255 / 255)
  const hsl = linearRgbToHsl(lr, lg, lb)
  hsl.l = Math.min(1, hsl.l * lScale)
  return hslToLinearRgb(hsl.h, hsl.s, hsl.l)
}

// === Terrain 計算 ===
function computeTerrain(req: TerrainWorkerRequest): TerrainWorkerResponse {
  const angSegs = req.angularSegments ?? 180
  const radSegs = req.radialSegments ?? 60
  const TERRAIN_RADIUS = req.terrainRadius ?? 2.0
  const HEIGHT_SCALE = req.heightScale ?? 1.5

  const { hueBinCount, chromaBinCount, gamutMaxChroma, maxChroma, logScale } = req
  const densityGrid = buildDensityGrid(req.densityCells, hueBinCount, chromaBinCount)
  const globalMaxC = Math.max(...Array.from(gamutMaxChroma))
  const lScale = bandLightnessScale(req.activeBand)
  const baseGround = bandBaseColorLinear(req.activeBand)

  const vertexCount = (angSegs + 1) * (radSegs + 1)
  const positions = new Float32Array(vertexCount * 3)
  const colors = new Float32Array(vertexCount * 3)

  for (let ai = 0; ai <= angSegs; ai++) {
    const hueNorm = ai / angSegs
    const theta = hueNorm * Math.PI * 2
    const cosTheta = Math.cos(theta)
    const sinTheta = Math.sin(theta)
    const maxR = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm, TERRAIN_RADIUS)
    const gamutC = sampleGamutMaxChroma(gamutMaxChroma, hueNorm)

    for (let ri = 0; ri <= radSegs; ri++) {
      const chromaNorm = ri / radSegs
      const radius = chromaNorm * maxR
      const actualChroma = chromaNorm * gamutC
      const densityChromaNorm = maxChroma > 0 ? actualChroma / maxChroma : 0
      const rawDensity = densityChromaNorm > 1.0
        ? 0
        : sampleDensity(densityGrid, hueBinCount, chromaBinCount, hueNorm, densityChromaNorm)
      const density = logScale && rawDensity > 0
        ? Math.log1p(rawDensity * 100) / Math.log1p(100)
        : rawDensity
      const height = density * HEIGHT_SCALE

      const vi3 = (ai * (radSegs + 1) + ri) * 3
      positions[vi3] = radius * cosTheta
      positions[vi3 + 1] = height
      positions[vi3 + 2] = radius * sinTheta

      const baseColor = sampleWheelColor(req.wheelColors, hueBinCount, chromaBinCount, hueNorm, densityChromaNorm)
      const scaledColor = processColor(baseColor.r, baseColor.g, baseColor.b, lScale)
      const blend = density > 0.001 ? 1.0 : chromaNorm * 0.25
      const final = lerpColor(baseGround.r, baseGround.g, baseGround.b, scaledColor.r, scaledColor.g, scaledColor.b, blend)

      colors[vi3] = final.r
      colors[vi3 + 1] = final.g
      colors[vi3 + 2] = final.b
    }
  }

  return { id: req.id, type: 'terrain', positions, colors }
}

// === RefGrid 計算 ===
function computeRefGrid(req: TerrainWorkerRequest): TerrainWorkerResponse {
  const TERRAIN_RADIUS = req.terrainRadius ?? 2.0
  const HEIGHT_SCALE = req.heightScale ?? 1.5

  const { hueBinCount, chromaBinCount, gamutMaxChroma, maxChroma, logScale } = req
  const densityGrid = buildDensityGrid(req.densityCells, hueBinCount, chromaBinCount)
  const globalMaxC = Math.max(...Array.from(gamutMaxChroma))
  const lScale = bandLightnessScale(req.activeBand)

  const CHROMA_RINGS = 6
  const HEIGHT_LEVELS = 4
  const RING_SEGS = 90
  const VERT_RIB_COUNT = 12
  const VERT_RIB_SEGS = 8

  // 最大サイズを事前計算して配列を確保
  const maxLineVertices = (CHROMA_RINGS * RING_SEGS + HEIGHT_LEVELS * RING_SEGS + VERT_RIB_COUNT * VERT_RIB_SEGS) * 2
  const linePositions = new Float32Array(maxLineVertices * 3)
  const lineColors = new Float32Array(maxLineVertices * 3)
  let lineIdx = 0

  const maxDots = CHROMA_RINGS * Math.ceil(RING_SEGS / 10) + HEIGHT_LEVELS * Math.ceil(RING_SEGS / 10) + VERT_RIB_COUNT
  const dotPositions = new Float32Array(maxDots * 3)
  const dotColors = new Float32Array(maxDots * 3)
  let dotIdx = 0

  function terrainHeightAt(hueNorm: number, chromaNorm: number): number {
    const gamutC = sampleGamutMaxChroma(gamutMaxChroma, hueNorm)
    const actualChroma = chromaNorm * gamutC
    const densityChromaNorm = maxChroma > 0 ? actualChroma / maxChroma : 0
    if (densityChromaNorm > 1.0) return 0
    const d = sampleDensity(densityGrid, hueBinCount, chromaBinCount, hueNorm, densityChromaNorm)
    const scaled = logScale && d > 0 ? Math.log1p(d * 100) / Math.log1p(100) : d
    return scaled * HEIGHT_SCALE
  }

  function colorAt(hueNorm: number, chromaNorm: number): { r: number; g: number; b: number } {
    const gamutC = sampleGamutMaxChroma(gamutMaxChroma, hueNorm)
    const actualChroma = chromaNorm * gamutC
    const densityChromaNorm = maxChroma > 0 ? actualChroma / maxChroma : 0
    const base = sampleWheelColor(req.wheelColors, hueBinCount, chromaBinCount, hueNorm, Math.min(1, densityChromaNorm))
    return processColor(base.r, base.g, base.b, lScale)
  }

  function pushLine(x1: number, y1: number, z1: number, r1: number, g1: number, b1: number,
                    x2: number, y2: number, z2: number, r2: number, g2: number, b2: number) {
    const i = lineIdx * 3
    linePositions[i] = x1; linePositions[i + 1] = y1; linePositions[i + 2] = z1
    linePositions[i + 3] = x2; linePositions[i + 4] = y2; linePositions[i + 5] = z2
    lineColors[i] = r1; lineColors[i + 1] = g1; lineColors[i + 2] = b1
    lineColors[i + 3] = r2; lineColors[i + 4] = g2; lineColors[i + 5] = b2
    lineIdx += 2
  }

  function pushDot(x: number, y: number, z: number, r: number, g: number, b: number) {
    const i = dotIdx * 3
    dotPositions[i] = x; dotPositions[i + 1] = y; dotPositions[i + 2] = z
    dotColors[i] = r; dotColors[i + 1] = g; dotColors[i + 2] = b
    dotIdx++
  }

  // 等彩度リング
  for (let ci = 1; ci <= CHROMA_RINGS; ci++) {
    const chromaNorm = ci / (CHROMA_RINGS + 1)
    for (let si = 0; si < RING_SEGS; si++) {
      const hueNorm1 = si / RING_SEGS
      const hueNorm2 = (si + 1) / RING_SEGS
      const theta1 = hueNorm1 * Math.PI * 2
      const theta2 = hueNorm2 * Math.PI * 2
      const maxR1 = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm1, TERRAIN_RADIUS)
      const maxR2 = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm2, TERRAIN_RADIUS)
      const r1 = chromaNorm * maxR1
      const r2 = chromaNorm * maxR2
      const h1 = terrainHeightAt(hueNorm1, chromaNorm) + 0.005
      const h2 = terrainHeightAt(hueNorm2, chromaNorm) + 0.005
      const x1 = r1 * Math.cos(theta1), z1 = r1 * Math.sin(theta1)
      const x2 = r2 * Math.cos(theta2), z2 = r2 * Math.sin(theta2)
      const c1 = colorAt(hueNorm1, chromaNorm)
      const c2 = colorAt(hueNorm2, chromaNorm)
      pushLine(x1, h1, z1, c1.r, c1.g, c1.b, x2, h2, z2, c2.r, c2.g, c2.b)
      if (si % 10 === 0) pushDot(x1, h1, z1, c1.r, c1.g, c1.b)
    }
  }

  // 水平リング
  for (let hi = 1; hi <= HEIGHT_LEVELS; hi++) {
    const y = (hi / (HEIGHT_LEVELS + 1)) * HEIGHT_SCALE
    for (let si = 0; si < RING_SEGS; si++) {
      const hueNorm1 = si / RING_SEGS
      const hueNorm2 = (si + 1) / RING_SEGS
      const theta1 = hueNorm1 * Math.PI * 2
      const theta2 = hueNorm2 * Math.PI * 2
      const r1 = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm1, TERRAIN_RADIUS)
      const r2 = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm2, TERRAIN_RADIUS)
      const x1 = r1 * Math.cos(theta1), z1 = r1 * Math.sin(theta1)
      const x2 = r2 * Math.cos(theta2), z2 = r2 * Math.sin(theta2)
      const c1 = colorAt(hueNorm1, 0.9)
      const c2 = colorAt(hueNorm2, 0.9)
      pushLine(x1, y, z1, c1.r, c1.g, c1.b, x2, y, z2, c2.r, c2.g, c2.b)
      if (si % 10 === 0) pushDot(x1, y, z1, c1.r, c1.g, c1.b)
    }
  }

  // 垂直リブ
  for (let ri = 0; ri < VERT_RIB_COUNT; ri++) {
    const hueNorm = ri / VERT_RIB_COUNT
    const theta = hueNorm * Math.PI * 2
    const r = gamutRadiusAt(gamutMaxChroma, globalMaxC, hueNorm, TERRAIN_RADIUS)
    const x = r * Math.cos(theta)
    const z = r * Math.sin(theta)
    const c = colorAt(hueNorm, 0.9)
    for (let vi = 0; vi < VERT_RIB_SEGS; vi++) {
      const y1 = (vi / VERT_RIB_SEGS) * HEIGHT_SCALE
      const y2 = ((vi + 1) / VERT_RIB_SEGS) * HEIGHT_SCALE
      pushLine(x, y1, z, c.r, c.g, c.b, x, y2, z, c.r, c.g, c.b)
    }
    pushDot(x, HEIGHT_SCALE, z, c.r, c.g, c.b)
  }

  return {
    id: req.id,
    type: 'refGrid',
    positions: linePositions.subarray(0, lineIdx * 3),
    colors: lineColors.subarray(0, lineIdx * 3),
    dotPositions: dotPositions.subarray(0, dotIdx * 3),
    dotColors: dotColors.subarray(0, dotIdx * 3),
  }
}

self.onmessage = (e: MessageEvent<TerrainWorkerRequest>) => {
  const req = e.data
  let resp: TerrainWorkerResponse

  if (req.type === 'terrain') {
    resp = computeTerrain(req)
  } else {
    resp = computeRefGrid(req)
  }

  // Transferable で高速転送
  const transfers: ArrayBuffer[] = [resp.positions.buffer, resp.colors.buffer]
  if (resp.dotPositions) transfers.push(resp.dotPositions.buffer)
  if (resp.dotColors) transfers.push(resp.dotColors.buffer)
  self.postMessage(resp, transfers)
}
