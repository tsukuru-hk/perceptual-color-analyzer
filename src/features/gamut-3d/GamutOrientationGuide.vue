<template>
  <primitive v-if="group" :object="group" />
</template>

<script setup lang="ts">
import { shallowRef, onScopeDispose } from 'vue'
import { useLoop, useTresContext } from '@tresjs/core'
import {
  Group,
  Mesh,
  CylinderGeometry,
  ConeGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  BufferGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  DoubleSide,
  Vector3,
  Quaternion,
  Color,
  Sprite,
  SpriteMaterial,
  CanvasTexture,
  type Camera,
} from 'three'
import { oklch, formatHex } from 'culori'
import { DEFAULT_GAMUT_SCALE } from '@/domain/oklchTo3d'

/**
 * 3D ガマットの「羅針盤」オーバーレイ。
 * 3属性の値を表示するのではなく、空間の読み方（軸=明度 / 外周=色相 / 中心からの距離=彩度）
 * を直感的に把握するためのガイド。ラベルや彩度矢印はカメラの向きに追従する。
 */

/** L 軸の半分の高さ（GamutReferenceGrid と揃える） */
const HALF_HEIGHT = 0.5 * DEFAULT_GAMUT_SCALE.lightnessScale
/** 色相環（土星の輪）の内周半径。ガマット外周(≈2.4)と少し隙間を空ける */
const RING_INNER = 2.5
/** 色相環の外周半径（帯を細めに） */
const RING_OUTER = 2.7
/** 色相環の分割数 */
const RING_SEGMENTS = 160
/** 彩度矢印の長さ（中心→ガマット外縁付近） */
const CHROMA_LEN = 2.4
/** 明度矢印の長さ（ワイヤーフレーム軸より少しだけ長く） */
const LIGHT_ARROW_LEN = HALF_HEIGHT * 2 + 0.65
/** ラベル 1px あたりのワールド単位（約0.7倍に縮小） */
const LABEL_PX_SCALE = 0.003
const DEG_TO_RAD = Math.PI / 180

/** 真上／真下ビュー判定：視線が Y 軸とこれ以上そろったら明度を隠す（≈18°以内） */
const VERTICAL_COS = Math.cos(18 * DEG_TO_RAD)
/** 真横ビュー判定：水平からの仰角がこれ以内なら色相ラベルを隠し 9時矢印を出す（±5°） */
const SIDE_SIN = Math.sin(5 * DEG_TO_RAD)

const Y_AXIS = new Vector3(0, 1, 0)
const ORIGIN = new Vector3(0, 0, 0)

/* -------------------------------------------------------------------------- */
/* ラベル（タイトル＋解説を 1 枚にまとめた、常にカメラを向く Sprite）         */
/* -------------------------------------------------------------------------- */

function makeInfoLabel(
  title: string,
  subtitle: string,
  opts: { color?: string } = {},
): Sprite {
  const { color = '#f5f5f5' } = opts
  const titleFont = '600 52px system-ui, -apple-system, sans-serif'
  const subFont = '500 28px system-ui, -apple-system, sans-serif'
  const subLines = subtitle ? subtitle.split('\n') : []
  const padX = 18
  const padY = 13
  const titleLH = 62
  const subLH = 34
  const gap = subLines.length ? 6 : 0

  const dpr = 2
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  ctx.font = titleFont
  let contentW = Math.ceil(ctx.measureText(title).width)
  ctx.font = subFont
  for (const l of subLines) contentW = Math.max(contentW, Math.ceil(ctx.measureText(l).width))

  const w = contentW + padX * 2
  const h = titleLH + gap + subLH * subLines.length + padY * 2
  canvas.width = w * dpr
  canvas.height = h * dpr
  ctx.scale(dpr, dpr)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = 'rgba(15,15,20,0.5)'
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 10)
    ctx.fill()
  } else {
    ctx.fillRect(0, 0, w, h)
  }

  ctx.font = titleFont
  ctx.fillStyle = color
  ctx.fillText(title, w / 2, padY + titleLH / 2)

  ctx.font = subFont
  ctx.fillStyle = 'rgba(222,222,232,0.75)'
  subLines.forEach((line, i) => {
    ctx.fillText(line, w / 2, padY + titleLH + gap + subLH * (i + 0.5))
  })

  const tex = new CanvasTexture(canvas)
  tex.anisotropy = 4
  const mat = new SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const sprite = new Sprite(mat)
  sprite.scale.set(w * LABEL_PX_SCALE, h * LABEL_PX_SCALE, 1)
  sprite.renderOrder = 1000
  return sprite
}

/* -------------------------------------------------------------------------- */
/* 太い矢印（シリンダー＋コーン）                                             */
/* -------------------------------------------------------------------------- */

function makeArrow(
  dir: Vector3,
  origin: Vector3,
  length: number,
  colorHex: number,
  opacity: number,
): Group {
  const g = new Group()
  const shaftRadius = 0.03
  const headLength = 0.34
  const headRadius = 0.11
  const shaftLength = Math.max(length - headLength, 0.01)
  const mat = new MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
  })
  const shaft = new Mesh(new CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 14), mat)
  shaft.position.y = shaftLength / 2
  shaft.renderOrder = 999
  const head = new Mesh(new ConeGeometry(headRadius, headLength, 18), mat)
  head.position.y = shaftLength + headLength / 2
  head.renderOrder = 999
  g.add(shaft, head)
  g.quaternion.copy(new Quaternion().setFromUnitVectors(Y_AXIS, dir.clone().normalize()))
  g.position.copy(origin)
  return g
}

/** 外周に沿った円弧状の矢印（色相が周回することを示す） */
function makeArcArrow(
  startDeg: number,
  arcDeg: number,
  radius: number,
  colorHex: number,
  opacity: number,
): Group {
  const g = new Group()
  const mat = new MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
  })
  const steps = 40
  const pts: Vector3[] = []
  for (let i = 0; i <= steps; i++) {
    const a = (startDeg + (arcDeg * i) / steps) * DEG_TO_RAD
    pts.push(new Vector3(radius * Math.cos(a), 0, radius * Math.sin(a)))
  }
  const tube = new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), steps, 0.03, 8, false), mat)
  tube.renderOrder = 999
  g.add(tube)

  // 終端に接線方向のコーン（色相が増える向き）
  const endA = (startDeg + arcDeg) * DEG_TO_RAD
  const end = new Vector3(radius * Math.cos(endA), 0, radius * Math.sin(endA))
  const tangent = new Vector3(-Math.sin(endA), 0, Math.cos(endA)).normalize()
  const cone = new Mesh(new ConeGeometry(0.11, 0.34, 18), mat)
  cone.position.copy(end).add(tangent.clone().multiplyScalar(0.14))
  cone.quaternion.copy(new Quaternion().setFromUnitVectors(Y_AXIS, tangent))
  cone.renderOrder = 999
  g.add(cone)
  return g
}

/* -------------------------------------------------------------------------- */
/* 色相環（土星の輪）                                                         */
/* -------------------------------------------------------------------------- */

function buildHueRing(): Mesh {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const col = new Color()

  for (let i = 0; i < RING_SEGMENTS; i++) {
    const hue = (i / RING_SEGMENTS) * 360
    const th = hue * DEG_TO_RAD
    const cx = Math.cos(th)
    const cz = Math.sin(th)
    positions.push(RING_INNER * cx, 0, RING_INNER * cz)
    positions.push(RING_OUTER * cx, 0, RING_OUTER * cz)
    const hex = formatHex(oklch({ mode: 'oklch', l: 0.63, c: 0.2, h: hue })) ?? '#888888'
    col.set(hex)
    colors.push(col.r, col.g, col.b, col.r, col.g, col.b)
  }
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const i1 = (i + 1) % RING_SEGMENTS
    const a = i * 2
    const b = i * 2 + 1
    const c = i1 * 2
    const d = i1 * 2 + 1
    indices.push(a, b, d, a, d, c)
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  const mat = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    side: DoubleSide,
    depthWrite: false,
  })
  return new Mesh(geo, mat)
}

/* -------------------------------------------------------------------------- */
/* 組み立て                                                                   */
/* -------------------------------------------------------------------------- */

// カメラ追従で毎フレーム更新する要素への参照
const lightnessGroup = shallowRef<Group | null>(null)
const hueLabel = shallowRef<Sprite | null>(null)
const hueArc = shallowRef<Group | null>(null)
const chromaArrow3 = shallowRef<Group | null>(null) // 3時方向（常時）
const chromaArrow9 = shallowRef<Group | null>(null) // 9時方向（真横のみ）
const chromaLabel = shallowRef<Sprite | null>(null)

function buildGroup(): Group {
  const root = new Group()

  /* --- 色相（外周）: 土星の輪のような色相環 --- */
  root.add(buildHueRing())
  // 外周に沿った約60°の円弧矢印。中心を0°に作り、毎フレーム rotation.y でビュー手前へ向ける
  const arc = makeArcArrow(-30, 60, RING_OUTER, 0xffffff, 0.85)
  hueArc.value = arc
  root.add(arc)

  // 色相ラベルは彩度（画面右固定）に対し、ビュー手前やや左へ追従（位置は毎フレーム更新）
  const hLabel = makeInfoLabel('色相', '外周をぐるりと\n一周する角度＝色み', { color: '#ffe9b0' })
  hLabel.position.set(RING_OUTER, 0.3, 0)
  hueLabel.value = hLabel
  root.add(hLabel)

  /* --- 彩度（中心からの距離）: カメラの3時（真横なら9時にも）方向へ伸びる矢印 --- */
  const c3 = makeArrow(new Vector3(1, 0, 0), ORIGIN, CHROMA_LEN, 0xffffff, 0.85)
  chromaArrow3.value = c3
  root.add(c3)

  const c9 = makeArrow(new Vector3(-1, 0, 0), ORIGIN, CHROMA_LEN, 0xffffff, 0.85)
  c9.visible = false
  chromaArrow9.value = c9
  root.add(c9)

  const cLabel = makeInfoLabel('彩度', '中心から遠いほど\n色が鮮やか', { color: '#ffd0d8' })
  cLabel.position.set(CHROMA_LEN + 0.4, 0.3, 0)
  chromaLabel.value = cLabel
  root.add(cLabel)

  /* --- 明度（軸）: 上向きの太い矢印（真上／真下では非表示） --- */
  const lgroup = new Group()
  lgroup.add(makeArrow(new Vector3(0, 1, 0), new Vector3(0, -HALF_HEIGHT, 0), LIGHT_ARROW_LEN, 0xffffff, 0.7))

  const lightLabel = makeInfoLabel('明度', '地軸に沿って\n上が明るく下が暗い', { color: '#ffffff' })
  lightLabel.position.set(0, -HALF_HEIGHT + LIGHT_ARROW_LEN + 0.38, 0)
  lgroup.add(lightLabel)

  lightnessGroup.value = lgroup
  root.add(lgroup)

  return root
}

const group = shallowRef<Group | null>(buildGroup())

/* -------------------------------------------------------------------------- */
/* カメラ追従更新                                                             */
/* -------------------------------------------------------------------------- */

// useTresContext().camera は UseCameraReturn（ref ではない）。実カメラは activeCamera。
const { camera } = useTresContext()
const { onBeforeRender } = useLoop()

const tmpRight = new Vector3()
const tmpQuat = new Quaternion()
const tmpNeg = new Vector3()
const tmpFront = new Vector3()
const tmpHueDir = new Vector3()
const localRight = new Vector3()
// 親（spin グループ）が自動回転している場合に、ワールド方向をガイドのローカル系へ戻す
const parentInvQuat = new Quaternion()

function updateForCamera(cam: Camera): void {
  const p = cam.position
  const len = Math.hypot(p.x, p.y, p.z) || 1
  const verticalness = Math.abs(p.y) / len

  const isVertical = verticalness > VERTICAL_COS
  const isSide = verticalness < SIDE_SIN

  // 明度は真上／真下では意味をなさないので隠す
  if (lightnessGroup.value) lightnessGroup.value.visible = !isVertical
  // 色相ラベルと弧矢印は真横では隠す
  if (hueLabel.value) hueLabel.value.visible = !isSide
  if (hueArc.value) hueArc.value.visible = !isSide
  // 9時方向の彩度矢印は真横のときだけ
  if (chromaArrow9.value) chromaArrow9.value.visible = isSide

  // 自動回転で親が回っていても、ラベル・矢印はビューに対して固定に見せたいので
  // ワールド方向を親回転の逆で打ち消してローカル系に変換してから適用する。
  const parent = group.value?.parent
  if (parent) parentInvQuat.copy(parent.quaternion).invert()
  else parentInvQuat.identity()

  // 彩度矢印は常にビューの3時（画面右）方向へ。水平面に射影して半径方向に保つ。
  tmpRight.set(1, 0, 0).applyQuaternion(cam.quaternion)
  tmpRight.y = 0
  if (tmpRight.lengthSq() < 1e-8) tmpRight.set(1, 0, 0)
  tmpRight.normalize()
  localRight.copy(tmpRight).applyQuaternion(parentInvQuat)

  if (chromaArrow3.value) chromaArrow3.value.quaternion.copy(tmpQuat.setFromUnitVectors(Y_AXIS, localRight))
  if (chromaArrow9.value) {
    tmpNeg.copy(localRight).negate()
    chromaArrow9.value.quaternion.copy(tmpQuat.setFromUnitVectors(Y_AXIS, tmpNeg))
  }
  if (chromaLabel.value) chromaLabel.value.position.copy(localRight).multiplyScalar(CHROMA_LEN + 0.4)

  // 色相ラベル・弧矢印はビュー手前やや左（手前方向 + 左方向）へ追従させて見やすく保つ
  tmpFront.set(p.x, 0, p.z)
  if (tmpFront.lengthSq() < 1e-8) tmpFront.copy(tmpRight).negate()
  else tmpFront.normalize()
  tmpHueDir.copy(tmpFront).sub(tmpRight).normalize().applyQuaternion(parentInvQuat)
  if (hueLabel.value) hueLabel.value.position.set(tmpHueDir.x * RING_OUTER, 0.3, tmpHueDir.z * RING_OUTER)
  if (hueArc.value) hueArc.value.rotation.y = -Math.atan2(tmpHueDir.z, tmpHueDir.x)
}

onBeforeRender(() => {
  const cam = camera.activeCamera.value as Camera | undefined
  if (cam) updateForCamera(cam)
})

/* -------------------------------------------------------------------------- */

function disposeGroupObj(g: Group | null) {
  if (!g) return
  g.traverse((obj) => {
    const anyObj = obj as any
    if (anyObj.geometry) anyObj.geometry.dispose()
    const mat = anyObj.material
    if (mat) {
      if (mat.map) mat.map.dispose()
      mat.dispose()
    }
  })
}

onScopeDispose(() => {
  disposeGroupObj(group.value)
})
</script>
