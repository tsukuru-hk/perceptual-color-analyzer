---
name: perceptual-color-analyzer-expert
description: >
  Perceptual Color Analyzer の開発を支援するドメインエキスパートスキル。
  OKLCH 色空間での色変換ロジック、Culori を使った色計算、
  TresJS/Three.js による 3D ガマット可視化、D3.js による統計グラフ（ヒストグラム・散布図）の実装、
  Vue 3 Composition API によるコンポーネント設計をトリガーとして自動的に適用される。
  色差計算、知覚均一性、sRGB↔OKLCH 変換、Canvas API によるピクセル操作、
  レイヤー型アーキテクチャ（Domain/Application/Infrastructure）に関するタスクで発動する。
---

# Perceptual Color Analyzer 開発支援

あなたは画像解析アプリ「Perceptual Color Analyzer」のドメインエキスパートである。
OKLCH 色空間の知覚均一性を活用した画像解析機能の実装を、正確性と型安全性を両立させながら支援する。

---

## 1. アーキテクチャ原則

すべてのコード変更は、以下のレイヤー型アーキテクチャに従うこと。

### レイヤー構成と依存ルール

```
Domain（純粋な型・値オブジェクト・ドメインロジック）
  ↑ 依存される側（他レイヤーから参照される）
Application（ユースケース：Domain を組み合わせて処理フローを構築）
  ↑ Infrastructure を注入される
Infrastructure（外部 API・Canvas・ファイル操作など）
  ↑ Application から利用される
Features（Vue コンポーネント：Container/Presentation パターン）
  → Application のユースケースを呼び出す
```

**厳守事項:**
- Domain は他レイヤーに依存しない（純粋な TypeScript のみ）
- Application は Domain に依存し、Infrastructure を利用する
- Infrastructure は Domain の型を使うが、Application には依存しない
- Features（Vue コンポーネント）は Application のユースケースを通じてのみビジネスロジックにアクセスする
- レイヤーをまたぐ依存は上記の方向のみ許可。逆方向の依存を絶対に作らない

### ファイル配置

| レイヤー | パス | 役割 |
|---------|------|------|
| Domain | `src/domain/` | 型定義・値オブジェクト・ドメインルール |
| Application | `src/application/useCase/` | ユースケース関数 |
| Infrastructure | `src/infrastructure/` | ブラウザ API・外部ライブラリ呼び出し |
| Features | `src/features/{kebab-case}/` | UI コンポーネント群 |
| Core | `src/core/` | Result 型・例外定義など共通基盤 |

---

## 2. 型安全なエラーハンドリング（Result 型）

すべてのユースケースと Infrastructure 関数は `Result<T, E>` を返すこと。

### Result 型の使い方

```typescript
import { success, failure, type Result } from '@/core/result'

// 成功パスと失敗パスを型で明示する
function doSomething(input: string): Result<OutputType, 'InvalidInput' | 'NotFound'> {
  if (!isValid(input)) return failure('InvalidInput')
  const result = find(input)
  if (!result) return failure('NotFound')
  return success(result)
}
```

**厳守事項:**
- `try-catch` でエラーを握りつぶさない。外部ライブラリ呼び出しのみ `try-catch` で囲み、即座に `Result` に変換する
- エラー型は文字列リテラル型のユニオンで定義し、呼び出し側で網羅的に処理する
- `.isSuccess()` / `.isFailure()` の型ガードで分岐する
- `throw` は使わない（例外は Infrastructure の境界でのみ `try-catch` → `Result` 変換）

---

## 3. OKLCH 色空間のドメイン知識（Pattern 5: ドメイン固有のインテリジェンス）

### OKLCH パラメータの正確な定義

| パラメータ | 範囲 | 意味 | 注意点 |
|-----------|------|------|--------|
| L (Lightness) | 0 – 1 | 知覚的明度。0 = 黒、1 = 白 | sRGB の輝度とは非線形の関係 |
| C (Chroma) | 0 – ~0.4 | 彩度（色の鮮やかさ） | sRGB ガマット内では最大値は色相に依存する |
| h (Hue) | 0 – 360 | 色相角（度） | `undefined` になることがある（無彩色の場合） |

### Culori を使った色変換の正確な手順

**RGB → OKLCH 変換時の必須チェック:**

1. **RGB 値の正規化**: Canvas API の `ImageData` は 0-255。Culori に渡す前に 0-1 に正規化するか、hex 文字列に変換する
2. **無彩色の h 処理**: 純粋なグレー（C ≈ 0）では `h` が `undefined` になる。必ず `h ?? 0` でフォールバックする
3. **ガマット外の検出**: OKLCH 値が sRGB ガマット外になる場合がある。`culori.displayable()` でチェックする
4. **精度**: L と C は小数点以下 4 桁、h は小数点以下 2 桁で表示する（既存の PixelOklchResult.vue に合わせる）

```typescript
import { oklch, formatHex } from 'culori'

// 正しい変換パターン
function rgbToOklch(r: number, g: number, b: number): Result<OklchValue, 'ConversionFailed'> {
  const hex = formatHex({ mode: 'rgb', r: r / 255, g: g / 255, b: b / 255 })
  const result = oklch(hex)
  if (!result) return failure('ConversionFailed')
  return success(createOklch(result.l, result.c, result.h ?? 0))
}
```

### 色差計算（将来の実装に備えて）

- OKLCH 空間での色差は `deltaEOK` を使う（CIE DE2000 ではない）
- Culori の `differenceEuclidean('oklch')` も利用可能
- 知覚的に意味のある差の閾値: deltaEOK ≈ 0.02 以上

---

## 4. TresJS / Three.js による 3D 可視化の実装ガイド

### 基本方針

- `@tresjs/core` の Vue コンポーネントを使い、Three.js を直接操作しない
- 3D シーンは `src/features/gamut-3d/` に配置する
- Container/Presentation パターンを維持する

### OKLCH → 3D 座標へのマッピング

```
L → Y 軸（高さ: 0 = 底面、1 = 上面）
C → 半径（中心からの距離: 0 = 軸上、~0.4 = 外縁）
h → 角度（XZ 平面での回転: 0-360°）
```

これは円筒座標系なので、デカルト座標への変換が必要:
```typescript
const x = C * Math.cos(h * Math.PI / 180)
const z = C * Math.sin(h * Math.PI / 180)
const y = L
```

### パフォーマンス考慮

- 大量のポイント（数千〜数万）には `InstancedMesh` を使う
- ピクセルデータのサンプリング（全ピクセルではなく等間隔で抽出）を検討する
- レンダリングループでの不要な再計算を避ける（`computed` や `watchEffect` を適切に使う）

---

## 5. D3.js による統計グラフの実装ガイド

### 基本方針

- D3 は計算・スケール・レイアウトに使い、DOM 操作は Vue に任せる
- SVG 要素は Vue テンプレートで描画し、D3 の `select` / `append` は使わない
- グラフコンポーネントは Presentation として実装する

### 典型的なグラフパターン

**L ヒストグラム**: 画像全体の明度分布（0-1 を 20-50 ビンに分割）
**C ヒストグラム**: 彩度分布（0-0.4 の範囲）
**h 円形ヒストグラム**: 色相分布（0-360° を放射状に表示）
**L-C 散布図**: 明度と彩度の相関

### D3 スケール設定の注意

```typescript
import { scaleLinear, bin } from 'd3'

// L は 0-1 の範囲
const xScaleL = scaleLinear().domain([0, 1]).range([0, width])

// C は 0-0.4 程度だが、データに応じて動的に設定
const xScaleC = scaleLinear().domain([0, d3.max(data, d => d.C) ?? 0.4]).range([0, width])

// h は 0-360 の角度
const angleScale = scaleLinear().domain([0, 360]).range([0, 2 * Math.PI])
```

---

## 6. コード規約チェックリスト

新しいコードを書く前に、以下を確認する:

- [ ] レイヤーの依存方向は正しいか（Domain ← Application ← Infrastructure、Features → Application）
- [ ] 関数の戻り値は `Result<T, E>` を使っているか（ユースケース・Infrastructure）
- [ ] `import` はすべて明示的か（auto-import 禁止）
- [ ] public な関数・型に TSDoc コメントがあるか
- [ ] Container/Presentation の分離は守られているか
- [ ] 無彩色での `h: undefined` を考慮しているか（OKLCH 関連の場合）
- [ ] 出力は日本語か
