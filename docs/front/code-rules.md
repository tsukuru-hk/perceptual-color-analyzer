# フロント コードルール

Vue コンポーネント・TypeScript コードの規約。AI と人間が同じルールで開発するための参照。

---

## 1. 配置

- UI のまとまりは `src/features/{機能名}/` に置く。
- 各 feature は以下の構成を持つ。

```
src/features/{機能名}/
├── {Name}Container.vue    # Container（状態・ロジック・ユースケース呼び出し）
├── {Component}.vue        # Presentation（表示のみ）
├── composables/           # feature 固有の composable（必要なら）
├── utils/                 # feature 固有の型・ヘルパー（必要なら）
└── index.ts               # 外部に公開するものの re-export
```

- ドメイン・ユースケース・インフラは `src/domain/`、`src/application/`、`src/infrastructure/` に置く（レイヤー維持）。
- 共通の型は `src/types/`、共通基盤は `src/core/` に置く。

## 2. Container / Presentation 分離

- **Container**: ref・reactive・computed・ユースケース呼び出し・イベントハンドラを持つ。Presentation を組み合わせる。
- **Presentation**: props でデータとコールバックを受け取り、表示だけ行う。状態やユースケースを直接扱わない。

## 3. Props 中心

- **emit は使わない**。親→子のコールバックは props で渡す（`onCanvasClick` など）。
- **v-model は使わない**。`:model-value` と `@update:model-value` で明示する。
- props の型は `defineProps<{ ... }>()` で TypeScript の型として定義する。

## 4. 明示的インポート

- auto-import に頼らず、`ref`、`computed` 等も含めすべて明示的に import する。
- AI が依存関係を正確に把握できるようにするため。

## 5. 命名

| 対象 | 規約 | 例 |
|------|------|----|
| feature ディレクトリ | kebab-case | `image-analysis` |
| Container コンポーネント | PascalCase + Container | `ImageAnalysisContainer.vue` |
| Presentation コンポーネント | PascalCase（機能を表す名前） | `ImageCanvas.vue` |
| composable | camelCase、`use` プレフィクス | `useAnimation.ts` |
| ユースケース | camelCase + UseCase | `loadImageUseCase.ts` |
| ドメインの型 | PascalCase | `OklchValue` |
| エラー型 | PascalCase + Error | `ImageLoadError` |

## 6. スタイル

- `<style scoped>` を基本とする。
- グローバルスタイルは `src/style.css` に置く。
- CSS 変数を使ったテーマ切り替え（light/dark）はグローバルスタイルで管理。

## 7. Vue ファイルのブロック順

- ブロックの順序は **template → script → style** とする。

## 8. 共通コンポーネントとコンポーザブル（適用方針）

### 方針

- **共通 UI パーツ**は `src/components/` に、**再利用可能なロジック**は `src/composables/` に置く方針とする。
- **実装と空箱の追加**: 上記のディレクトリ・ファイルの**実装**および**空のファイル・ディレクトリの作成**は、依頼があるまで行わない。AI も勝手に追加しない。

### 適用時の構造イメージ（予定）

実装を依頼する際の参照用。現時点では作成しない。

```
src/
├── components/              # 共通 UI（複数 feature で使い回す）
│   ├── FileDropZone.vue
│   ├── ImagePreview.vue
│   ├── OklchResultPanel.vue
│   ├── SectionCard.vue
│   ├── PrimaryButton.vue
│   └── index.ts
├── composables/             # 共通ロジック
│   ├── useCanvasImageCoords.ts
│   ├── useFileLoad.ts
│   ├── useAnalysisFlow.ts
│   ├── useCountUp.ts
│   └── index.ts
├── features/
│   ├── image-analysis/      # 既存
│   ├── grayscale-map/       # 輝度・彩度マッピング（追加時）
│   └── gamut-3d/            # 3D 色空間（追加時）
└── ...
```

- 共通コンポーネントは features から import して利用する。composable はユースケースを呼ばず、状態・DOM まわり・座標計算などに使う。
