# Web 公開ガイド

このアプリは静的サイト（SPA）なので、ビルドした `dist/` をホスティングするだけで Web 上で公開できます。

## 前提

```bash
npm run build   # dist/ に本番用ファイルが出力される
```

## 1. Cloudflare Pages（推奨）

README の想定どおり。無料枠が広く、Git 連携で自動デプロイ可能。

### 手順（Git 連携）

1. リポジトリを GitHub などに push する。
2. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
3. リポジトリを選択し、ビルド設定を入力：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: 空（リポジトリルート）
4. **Save and Deploy**。完了後、`https://<プロジェクト名>.pages.dev` で公開される。

### 手順（Wrangler CLI）

```bash
npm install -g wrangler
npm run build
wrangler pages deploy dist --project-name=perceptual-color-analyzer
```

初回は `wrangler login` で Cloudflare にログインする。

---

## 2. その他の選択肢

| サービス | 特徴 |
|----------|------|
| **Vercel** | Git 連携が簡単。Vite を自動検出。 |
| **Netlify** | 同上。`npm run build` / `dist` を指定するだけ。 |
| **GitHub Pages** | リポジトリに紐づけて無料。`vite.config.ts` で `base: '/リポジトリ名/'` が必要。 |

### Vercel の例

1. [vercel.com](https://vercel.com) で GitHub と連携。
2. リポジトリを Import。Framework Preset は **Vite** のまま。
3. Build Command: `npm run build`、Output Directory: `dist` で Deploy。

### GitHub Pages の例

リポジトリ名が `perceptual-color-analyzer` の場合、サブパス公開になるので `vite.config.ts` に次を追加：

```ts
export default defineConfig({
  base: '/perceptual-color-analyzer/',
  // ...
})
```

その後、GitHub の **Settings** → **Pages** で Source を **GitHub Actions** にし、`workflows` で Vite ビルド＆`peaceiris/actions-gh-pages` などで `dist` をデプロイするワークフローを用意する。

---

## まとめ

- **まず試すなら**: Cloudflare Pages の「Connect to Git」でリポジトリを連携し、ビルドコマンド `npm run build`・出力 `dist` を指定してデプロイ。
- **ドメイン**: Cloudflare Pages なら `*.pages.dev` のほか、独自ドメインも設定可能（Dashboard の Custom domains）。
