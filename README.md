# Perceptual Color Analyzer

知覚的な色空間 **OKLCH** を用いて、画像の彩度（Chroma）・明度（Lightness）を解析・可視化する Web アプリです。

## 目的

- 画像のピクセルを OKLCH に変換し、知覚的な色情報として把握する。
- 彩度ベースのグレースケール変換、3D ガマット表示、統計分布グラフなどの可視化を追加予定。

## 技術スタック

- **Frontend**: Vue 3 (Composition API) + TypeScript + Vite
- **Color**: [Culori](https://culorijs.org/)（OKLCH 変換）
- **3D（準備済）**: TresJS + Three.js
- **Graph（準備済）**: D3.js
- **Animation（準備済）**: GSAP, Motion for Vue
- **Deployment**: Cloudflare Pages 想定

## 開発

```bash
npm install
npm run dev   # 開発サーバー起動
npm run build # 本番ビルド
npm run preview # ビルドのプレビュー
```

## アーキテクチャ

```
画面 (features/) → Application (useCase/) → Domain (oklch 等)
                                            ↑
                               Infrastructure (imageLoader, pixelReader 等)
```

- **Domain**: 値オブジェクト（OklchValue 等）。外部ライブラリに依存しない。
- **Application**: ユースケース。Domain と Infrastructure を組み合わせてシナリオを実行。
- **Infrastructure**: ブラウザ API・Culori 等に依存する実装。
- **features/**: フロントの機能単位。Container（状態・ロジック）と Presentation（表示）に分離。

エラーは **Result 型** で返し、画面で `isFailure()` をチェックして表示する。

## ディレクトリ構成

```
src/
├── core/                         # 共通基盤（Result, 例外）
├── domain/                       # ドメイン層
├── application/useCase/          # ユースケース
├── infrastructure/               # インフラ層
├── features/                     # フロントの機能単位
│   └── image-analysis/
├── types/
├── App.vue
├── style.css
└── main.ts

docs/
├── README.md                     # ドキュメントのナビゲーション
├── front/code-rules.md            # フロントのコードルール
├── architecture/                 # 設計判断の記録
│   ├── src-structure-comparison.md
│   └── tech-stack.md
└── worklog/                      # 日付ベースの作業ログ
```

- 依存の向き: features → Application → Domain ← Infrastructure
- フロントのルール: [docs/front/code-rules.md](./docs/front/code-rules.md)

## ドキュメント

- **docs のナビゲーション**: [docs/README.md](./docs/README.md)
- **AI 向け参照一覧**: [AGENTS.md](./AGENTS.md)

## 用語

| 用語 | 説明 |
|------|------|
| OKLCH | 知覚的に均等な色空間。L（明度）・C（彩度）・h（色相）の 3 成分。 |
| L / 明度 | 0（黒）〜1（白）。 |
| C / 彩度 | 0（無彩色）〜約 0.4（最大彩度）。 |
| h / 色相 | 0〜360 の角度（度数）。 |
| Result 型 | 成功 or 失敗を型安全に表す型。ユースケースの戻り値に使用。 |

## ロードマップ

1. ✅ 画像アップロード & Canvas 表示
2. ✅ 1 ピクセルの OKLCH（L, C, h）抽出
3. 彩度に基づくグレースケール可視化
4. 3D ガマット・各種グラフのビジュアライゼーション
