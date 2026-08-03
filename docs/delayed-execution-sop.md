# 遅延実行の運用手順（Claude Code / Cowork）

> 2026-06-22 策定。「N時間後にClaude/Coworkを動かしたい」場合の標準手順。

## 原則

1. **macOS `at` / `cron` は使わない** — `atrun` が無効な環境では発火しない。発火しても Claude Code のセッション外なので環境変数やパーミッションが不安定。
2. **Claude Code 自身の scheduled task を使う** — セッション内で完結し、環境・認証が引き継がれる。
3. **Cowork の scheduled task も使える** — Cowork セッションから `schedule` スキルで定期/遅延実行を設定可能。
4. **必ず短時間テストしてから本番予約** — 2分後テストで発火を確認してから、本番の遅延を入れる。

## 方法1: Claude Code セッション内（推奨・単発タスク）

ターミナルで Claude Code が起動中の状態で、プロンプトとして以下を入力：

### 標準プロンプト（テスト用・2分後）

```
in 2 minutes, say "schedule test ok" and run pwd
```

発火を確認したら本番予約：

### 標準プロンプト（本番用・N時間後）

```
in 1 hour, read docs/delayed-execution-sop.md and then do the following:
- （ここにやりたいタスクを書く）
- 完了したら tsc -b && bun run build で検証
- 結果を `docs/archive/task-handoffs.md` に Handoff として追記
```

### 注意

- Claude Code セッションが開いている間だけ有効。ターミナルを閉じると予約は消える。
- `git push` は自動化しない。理由・オーナー承認の有無にかかわらずエージェントは実行せず、変更と検証までを自動化する。push はオーナー本人が手動で行う。

## 方法2: Cowork scheduled task（定期実行・リマインダー）

Cowork で `/schedule` または自然言語で予約：

```
毎朝9時に、`docs/archive/task-handoffs.md` の最新 Handoff を読んで残タスクのサマリーを出して
```

```
30分後に、packages/web/src/web/pages/service.tsx の Stripe リンクが本番で動いているか確認して
```

- Cowork の scheduled task はセッションを跨いで永続する。
- 定期実行（cron式）と単発（fireAt）の両方に対応。

## 方法3: GitHub Actions（完全無人・CI連携）

リポジトリの `.github/workflows/` に cron ワークフローを置く方法。

- 環境変数は GitHub Secrets で管理。
- 常時起動の Mac mini がなくても確実に動く。
- コスト: GitHub Actions の無料枠内なら $0。

用途: 毎日のビルドヘルスチェック、定期的なリンク切れ検査など。

## やってはいけないこと

| NG | 理由 |
|---|---|
| `at` / `atrun` | macOS で無効化されていることが多い。発火しない |
| `crontab -e` で Claude CLI を直接呼ぶ | セッション外で環境が不完全、API キーやパスが通らない |
| `sleep 3600 && claude ...` をバックグラウンドで | ターミナル切断で死ぬ。ログも残らない |
| `launchd` plist | 設定が複雑で、失敗時のデバッグが困難 |

## チェックリスト（遅延実行を設定するとき）

- [ ] 2分後テストで発火を確認した
- [ ] タスク内容を MD ファイルまたはプロンプトに明文化した
- [ ] permission mode を確認した（通常は `acceptEdits`）
- [ ] push はオーナー本人が手動で行う。エージェントによる自動・手動実行を選択肢にしていない
- [ ] 不要になった予約（`at` ジョブ等）を削除した
