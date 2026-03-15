---
name: no-single-char-variables
description: Avoid single-character variable/parameter names throughout the codebase; use short but descriptive names instead
type: feedback
---

一文字のマジックワード変数名（`x`, `y`, `e`, `i`, `r`, `g`, `b`, `L`, `C`, `h`, `p` など）は使わない。短くてよいので、意味がわかる名前にする。

例:
- `x`, `y` → `clickedX`, `clickedY` / `pixelX`, `pixelY`
- `e` → `event` / `error`
- `i` → `byteOffset`, `index` など
- `r`, `g`, `b` → `red`, `green`, `blue`
- `L`, `C`, `h` → `lightness`, `chroma`, `hue`
- `p` → `value`, `oklchValue` など

**Why:** コードの可読性向上。JSDoc コメントで補足するより、変数名自体で意味を伝えるべき。
**How to apply:** 新規コード・既存コードのリファクタリング両方で、一文字変数を見つけたら意味のある名前に置き換える。ループ変数の `i` も `index` や用途に応じた名前にする。
