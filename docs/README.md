# docs/ ナビゲーション

## 参照先

| 目的 | ファイル |
|------|----------|
| **設計判断の記録**（技術選定・構成の理由） | [architecture/](./architecture/) |
| **フロントのコードルール** | [front/code-rules.md](./front/code-rules.md) |
| **作業ログ** | [worklog/](./worklog/) |
| **学習・調査メモ** | [studylog/](./studylog/) |
| プロジェクト概要・開発方法 | リポジトリルートの [README.md](../README.md) |
| AI 向け参照一覧 | リポジトリルートの [AGENTS.md](../AGENTS.md) |

## architecture/

- [tech-stack.md](./architecture/tech-stack.md) — 技術スタックと選定理由
- [src-structure-comparison.md](./architecture/src-structure-comparison.md) — src/ のレイヤー型 vs フィーチャーベースの比較

## studylog/

学習・調査のメモを置く。OKLCH やライブラリの調べもの、試したコードの断片など、本番コードや worklog には書かないようなメモ用。ファイル名・形式は任意。運用で必須ではない。

## 運用

- **作業ログ**: 作業完了時は [worklog/](./worklog/) に `YYYY-MM-DD.md` で簡潔に記録する。
- **設計判断**: 技術選定やアーキテクチャ変更は [architecture/](./architecture/) に「目的・背景・選択肢・結論」を残す。
- **用語**: 新しいドメイン用語は README の「用語」セクションに追加する。

