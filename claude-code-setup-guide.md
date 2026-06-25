# Claude Code 環境整備ガイド — eguchi-portfolio-app

> 秋ちゃんの eguchi-portfolio-app 向け。7つのステアリング手法 + α を全て整備する。

## 現状と目標

| 手法 | 現状 | 目標 |
|---|---|---|
| CLAUDE.md (root) | ✅ §0 invariants 運用中 | 整理・200行以下に |
| CLAUDE.md (subdirectory) | ❌ | packages/web, packages/api に配置 |
| Rules (.claude/rules/) | ❌ | path-scoped ルール 5本 |
| Skills (.claude/skills/) | ❌ | ナイトラン、デプロイ、コードレビュー等 |
| Subagents (.claude/agents/) | ❌ | セキュリティ、パフォーマンス、EXIF監査 |
| Hooks (settings.json) | ❌ | 通知、フォーマット、compaction保護 |
| Plugins | ❌ | TypeScript LSP + 有用なもの |

---

## ディレクトリ構成（完成形）

```
eguchi-portfolio-app/
├── CLAUDE.md                          # ← 既存（精査して200行以下に）
├── .claude/
│   ├── settings.json                  # hooks + permissions
│   ├── settings.local.json            # 秋の個人設定（gitignore）
│   ├── rules/
│   │   ├── api-validation.md          # src/api/** 向け
│   │   ├── db-migrations.md           # drizzle migrations 向け
│   │   ├── r2-upload.md               # R2/sharp 操作向け
│   │   ├── react-components.md        # React 19 コンポーネント向け
│   │   └── no-manual-encoding.md      # §0 invariant 強制
│   ├── skills/
│   │   ├── night-run/SKILL.md         # ナイトラン手順
│   │   ├── deploy/SKILL.md            # Railway デプロイ手順
│   │   ├── gallery-feature/SKILL.md   # ギャラリー機能追加手順
│   │   └── exif-preset/SKILL.md       # EXIF プリセット追加手順
│   ├── agents/
│   │   ├── security-reviewer.md       # セキュリティ監査
│   │   ├── perf-auditor.md            # パフォーマンス監査
│   │   └── exif-checker.md            # EXIF/メタデータ整合性チェック
│   └── hooks/
│       └── protect-invariants.sh      # §0 invariant ガード
├── packages/
│   ├── web/
│   │   └── CLAUDE.md                  # web パッケージ固有の規約
│   └── api/
│       └── CLAUDE.md                  # api パッケージ固有の規約
```

---

## 1. CLAUDE.md 精査方針

現在のCLAUDE.mdから以下を切り出す：

- **手順的な記述** → `.claude/skills/` へ移動
- **特定ディレクトリにしか関係しない規約** → `.claude/rules/` または subdirectory CLAUDE.md へ
- **「絶対やるな」系** → hooks（PreToolUse）で決定的に防ぐ

残すもの（CLAUDE.md に留める）：
- §0 invariants の一覧（参照用。enforcement は hooks で）
- モノレポ構成の概要
- ビルド/テストコマンド（`bun test`, `bun run dev` 等）
- デプロイ先情報（Railway, Cloudflare R2, Turso）
- Git ブランチ規約

---

## 2. Rules（.claude/rules/）

### api-validation.md
```markdown
---
paths:
  - "packages/api/**"
  - "**/*.handler.ts"
---
API ハンドラでは必ず assertOk() でレスポンスを検証する。
Hono のルート定義では zValidator を使って入力バリデーションを行う。
エラーレスポンスは { error: string, details?: unknown } の形式で統一する。
```

### db-migrations.md
```markdown
---
paths:
  - "**/drizzle/**"
  - "**/migrations/**"
  - "**/*.sql"
---
マイグレーションファイルは append-only。既存のマイグレーションを編集・削除しない。
新しいマイグレーションは `bun run db:generate` で生成する。
Turso のリモート DB に直接 DROP TABLE しない。
```

### r2-upload.md
```markdown
---
paths:
  - "**/r2/**"
  - "**/upload**"
  - "**/sharp**"
  - "**/image**"
---
R2 アップロード時は sharp で WebP 変換を行い、Content-Type を正しく設定する。
Content-Encoding を手動で設定しない（§0 invariant）。
R2 のバケット名やアクセスキーをコードにハードコードしない。
```

### react-components.md
```markdown
---
paths:
  - "packages/web/src/**/*.tsx"
  - "packages/web/src/**/*.jsx"
---
React 19 の機能を活用する（use(), useActionState 等）。
Tailwind CSS 4 のユーティリティクラスを使う。
コンポーネントは default export。Props に型定義をつける。
Lightbox 関連の変更時は既存の Lightbox 修正を壊さないよう注意。
```

### no-manual-encoding.md
```markdown
---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
Content-Encoding ヘッダを手動で設定するコードを書かない。
これは §0 invariant であり、Railway のプロキシが自動処理する。
違反するとレスポンスが二重圧縮されてブラウザで壊れる。
```

---

## 3. Skills（.claude/skills/）

### night-run/SKILL.md
```markdown
---
name: night-run
description: Claude Code ナイトラン（自律夜間ループ）のセットアップと実行手順
disable-model-invocation: true
---
# ナイトラン実行手順

$ARGUMENTS にタスク指示がある場合はそれに従う。なければ以下のデフォルトフロー。

## 前提
- クレジットリセット: 午前 3:10 (JST)
- 起動タイミング: 午前 3:15 (JST)
- 詳細手順: claude-code-night-run.md を参照

## セットアップ
1. ターミナルで以下を実行：
   ```bash
   caffeinate -d &
   sleep $(($(date -j -f "%H:%M" "03:15" +%s) - $(date +%s))) && claude
   ```
2. 起動後、CLAUDE.md を読み込んで現在の状態を把握
3. 直近の git log と TODO/FIXME を確認

## 実行ルール
- `--effort high` で実行
- 変更前に必ず `bun typecheck` を通す
- 各機能実装後に `bun test` を実行
- コミットは細かく、メッセージは英語で
- エラーが3回連続したら方針を変える（同じアプローチを繰り返さない）

## 終了条件
- クレジット残量が少なくなったら現在の作業をコミットして終了
- 未完了タスクは CLAUDE.md か issue に記録
```

### deploy/SKILL.md
```markdown
---
name: deploy
description: Railway へのデプロイ手順とデプロイ前チェックリスト
disable-model-invocation: true
---
# デプロイ手順

## デプロイ前チェック
1. `bun typecheck` — 型エラーがないこと
2. `bun test` — テストが全て通ること
3. `bun run build` — ビルドが成功すること
4. 環境変数の確認（新しいものがあれば Railway に追加）

## デプロイ
- GitHub の main ブランチに push すると Railway が自動デプロイ
- watch path: `/packages/web/**`
- デプロイ後、https://akieguchi.com で動作確認

## ロールバック
- Railway ダッシュボードから前のデプロイに revert
- または `git revert` して再 push

## DB マイグレーション
- Turso のマイグレーションはデプロイ前に手動実行
- `bun run db:push` でリモートに適用
```

### gallery-feature/SKILL.md
```markdown
---
name: gallery-feature
description: 新しいギャラリーやシリーズを追加する手順。film/digital フィルタリング、独立ソート順を含む
---
# ギャラリー/シリーズ追加

## 新規ギャラリー追加
1. admin 画面から Gallery を作成
2. galleryType: 'film' | 'digital' を設定
3. sortOrder は既存ギャラリーと独立（gallery ごとに管理）
4. サムネイル画像を R2 にアップロード

## 新規シリーズ追加
1. admin 画面から Series を作成
2. シリーズにも独立した sortOrder がある
3. ギャラリーとシリーズのソート順は互いに影響しない

## 写真追加
1. BulkEditTable でまとめて編集（debounced autosave）
2. EXIF 情報は自動取得 → camera/lens プリセットとマッチング
3. Camera/Lens Copy/Paste 機能で効率化
```

### exif-preset/SKILL.md
```markdown
---
name: exif-preset
description: 新しいカメラ・レンズの EXIF プリセットを追加する手順
---
# EXIF プリセット追加

## カメラプリセット
- EXIF の Make + Model から自動マッチング
- 表示名（例: "PENTAX 67"）とスラッグを設定
- film/digital フラグを設定

## レンズプリセット
- EXIF の LensModel から自動マッチング
- マウント情報は任意

## 秋の機材リスト（参考）
- PENTAX 67 (film)
- Leica M6 (film)
- Bronica S2 (film)
- Sony α1 (digital)
- 主要フィルム: Portra 400
```

---

## 4. Subagents（.claude/agents/）

### security-reviewer.md
```markdown
---
name: security-reviewer
description: コードのセキュリティ脆弱性をレビューする。API キー露出、XSS、SQL インジェクション等
tools: Read, Grep, Glob, Bash
model: sonnet
---
あなたはセキュリティエンジニアです。以下の観点でコードをレビューしてください：

- 環境変数やシークレットがコードにハードコードされていないか
- R2 バケットのアクセスキーが露出していないか
- Turso の DB 接続情報が安全に管理されているか
- XSS 脆弱性（React の dangerouslySetInnerHTML 等）
- 入力バリデーションの漏れ
- CORS 設定の問題

具体的なファイル名と行番号を示し、修正案を提示してください。
```

### perf-auditor.md
```markdown
---
name: perf-auditor
description: パフォーマンス問題を調査する。画像最適化、バンドルサイズ、DB クエリ効率
tools: Read, Grep, Glob, Bash
model: sonnet
---
あなたはパフォーマンスエンジニアです。以下を調査してください：

- sharp による画像変換が最適か（WebP 品質設定、リサイズ）
- R2 からの配信にキャッシュヘッダが適切に設定されているか
- Drizzle クエリに N+1 問題がないか
- React コンポーネントの不要な再レンダリング
- バンドルサイズに不要な依存関係が含まれていないか
- HTML の no-store 設定（§0 invariant）が守られているか

数値的な根拠を含めて報告してください。
```

### exif-checker.md
```markdown
---
name: exif-checker
description: 写真データの EXIF メタデータと DB レコードの整合性をチェックする
tools: Read, Grep, Glob, Bash
model: haiku
---
あなたはデータ整合性チェッカーです。以下を確認してください：

- DB 内の写真レコードに camera/lens 情報が正しく紐づいているか
- EXIF プリセットに未マッチの camera/lens パターンがないか
- film/digital のフラグがギャラリーと写真で一致しているか
- sortOrder に重複や欠番がないか

不整合があれば、該当レコードの ID と修正方法を一覧で報告してください。
```

---

## 5. Hooks（.claude/settings.json）

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude Code の操作が必要です\" with title \"Claude Code\" sound name \"Ping\"'"
          }
        ]
      }
    ],

    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-invariants.sh"
          }
        ]
      }
    ],

    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "FILE=$(jq -r '.tool_input.file_path // empty'); if [ -n \"$FILE\" ] && echo \"$FILE\" | grep -qE '\\.(ts|tsx|js|jsx|json|css|md)$'; then cd \"$CLAUDE_PROJECT_DIR\" && npx prettier --write \"$FILE\" 2>/dev/null; fi"
          }
        ]
      }
    ],

    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "BACKUP_DIR=\"$CLAUDE_PROJECT_DIR/.claude/chat-backups\"; mkdir -p \"$BACKUP_DIR\"; echo \"[$(date '+%Y-%m-%d %H:%M:%S')] Pre-compaction backup\" >> \"$BACKUP_DIR/compaction-log.txt\"; echo \"Session: $CLAUDE_SESSION_ID\" >> \"$BACKUP_DIR/compaction-log.txt\""
          }
        ]
      }
    ],

    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Compaction 後リマインダー: §0 invariants を確認 → withRetry, 3-place settings sync, assertOk, no manual Content-Encoding, HTML always no-store。bun typecheck を忘れずに。'"
          }
        ]
      }
    ],

    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "変更されたファイルがある場合、bun typecheck が実行されたか確認してください。実行されていない場合は {\"ok\": false, \"reason\": \"bun typecheck を実行してから完了してください\"} を返してください。型チェックが実行済みか、ファイル変更がない場合は {\"ok\": true} を返してください。"
          }
        ]
      }
    ]
  }
}
```

---

## 6. Hook スクリプト

### .claude/hooks/protect-invariants.sh
```bash
#!/bin/bash
# §0 invariant を決定的にガードする
# Content-Encoding の手動設定を検出してブロック

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.content // empty')

# Content-Encoding ヘッダの手動設定を検出
if echo "$INPUT" | jq -r '.tool_input.content // .tool_input.new_string // empty' | grep -qi 'content-encoding'; then
  echo "§0 INVARIANT VIOLATION: Content-Encoding を手動で設定しないでください。Railway のプロキシが自動処理します。" >&2
  exit 2
fi

# .env ファイルへの書き込みをブロック
if echo "$FILE_PATH" | grep -qE '\.env($|\.)'; then
  echo "BLOCKED: .env ファイルは直接編集しないでください。環境変数は Railway ダッシュボードで管理します。" >&2
  exit 2
fi

exit 0
```

---

## 7. Subdirectory CLAUDE.md

### packages/web/CLAUDE.md
```markdown
# packages/web

フロントエンド（React 19 + Tailwind CSS 4）

## ビルド
- `bun run dev` — 開発サーバー
- `bun run build` — プロダクションビルド
- `bun typecheck` — 型チェック

## 規約
- コンポーネントは `src/components/` に配置
- ページは `src/pages/` に配置
- Lightbox は既存の修正済みロジックを壊さないこと
- BulkEditTable の autosave は debounce 付き
- admin 系コンポーネントの変更時は homeCtaEnabled トグルの動作を確認
```

### packages/api/CLAUDE.md
```markdown
# packages/api

バックエンド（Hono + Drizzle ORM + Turso）

## 規約
- 全 API レスポンスで assertOk() を使用
- withRetry でリトライラッパーを使用
- 3-place settings sync パターンを維持
- R2 操作時は Content-Encoding を手動設定しない
- Contact form は Formspree 経由

## DB
- ORM: Drizzle
- DB: Turso (libSQL)
- マイグレーション: append-only
```

---

## 8. 個人設定（~/.claude/settings.json に追加）

```json
{
  "model": "opus",
  "effort": "high",
  "hooks": {
    "Notification": [
      {
        "matcher": "idle_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude が完了しました\" with title \"Claude Code\" sound name \"Glass\"'"
          }
        ]
      }
    ]
  }
}
```

---

## 9. おすすめプラグイン

Claude Code 内で以下を実行：

```bash
# TypeScript LSP（型チェック連携）
/plugin install typescript-lsp@claude-plugins-official

# コードレビュー（ビルトイン /code-review も活用）
# セキュリティスキャン
/plugin install security-guidance@claude-plugins-official
```

その他のおすすめ：
- `commit-commands` — コミットメッセージ生成
- marketplace を `/plugin` で browse して Bun/Hono 関連があれば追加

---

## 10. 導入手順（チェックリスト）

1. [ ] CLAUDE.md を精査 → 手順系を skills に切り出して 200行以下に
2. [ ] `.claude/rules/` に 5つのルールファイルを作成
3. [ ] `.claude/skills/` に 4つのスキルを作成
4. [ ] `.claude/agents/` に 3つのサブエージェントを作成
5. [ ] `.claude/hooks/protect-invariants.sh` を作成して `chmod +x`
6. [ ] `.claude/settings.json` に hooks 設定を追加
7. [ ] `~/.claude/settings.json` に個人設定を追加
8. [ ] `packages/web/CLAUDE.md` と `packages/api/CLAUDE.md` を作成
9. [ ] `.claude/chat-backups/` を `.gitignore` に追加
10. [ ] `.claude/settings.local.json` を `.gitignore` に追加
11. [ ] Claude Code を起動して `/hooks` で設定確認
12. [ ] `/plugin` でプラグインをインストール
13. [ ] テスト: 適当なファイルを編集して hooks が発火するか確認

---

## Ivy's House（別リポジトリ）への展開

同じ構成を Ivy's House にも適用できるが、**リポジトリは絶対に混ぜない**。
Ivy's House 用には以下を別途作成：

- `.claude/rules/astro-conventions.md` — Astro + Sveltia CMS 規約
- `.claude/rules/i18n.md` — Traditional Chinese コンテンツ規約
- `.claude/skills/deploy-cf-pages/SKILL.md` — Cloudflare Pages デプロイ手順
- `.claude/agents/i18n-reviewer.md` — 繁体中文の校正エージェント
