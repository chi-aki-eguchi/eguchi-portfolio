---
name: night-run
description: 自走改善ループ（ナイトラン）の実行手順。クレジットリセット駆動で1サイクル=考える+1件実装+報告+git push。
disable-model-invocation: true
---

# ナイトラン実行手順

$ARGUMENTS にタスク指示がある場合はそれに従う。なければ以下のデフォルトフロー。

正本仕様書: `refine-and-loop-spec.md`（T0節が運用の正本）

## 基本ルール

- CLAUDE.md と `task.md` の最新 Handoff を最初に読んで現状把握してから着手
- 確認なしで進めてOK。判断に迷ったらスキップして次へ
- 1つのタスクに30分以上ハマったらスキップして別の改善へ
- 各フェーズ完了後に `tsc -b` + `bun run build` 確認 → `git push`
- 完了・スキップ・発見した問題を `NIGHT-RUN-LOG.md` に追記

## 禁止事項（絶対）

- DBスキーマの変更（Drizzle マイグレーション）
- R2 バケットの直接操作
- 環境変数の追加・変更
- 新機能の追加（既存機能の改善・バグ修正のみ）
- `.env` ファイルの直接編集

## 1サイクルの流れ（T0 正本）

1. **考える** — 今サイトと秋のために何をすべきか1つ選ぶ（R > S3 > S1 の優先順）
2. **実装** — 安全な範囲で1件だけ実装・改善
3. **報告** — 何を考えて何をしたか・次に気になることを書く
4. **ビルド確認** — `cd packages/web && tsc -b && bun run build`
5. **デプロイ** — `git push`（Railway が自動デプロイ）
6. **次の起動予約** — クレジット上限メッセージの `resets HH:MM (Asia/Tokyo)` を読み、+2〜3分後に次を予約

## 優先作業カテゴリ

### R（最優先: 今すぐ直すバグ）

- 公開側の表示崩れ・リンク切れ
- スマホで詰まる操作
- Lightbox・ギャラリーの不具合
- 管理画面の保存エラー

### S3（毎回やること: デバッグ・審査）

- `tsc -b` エラー・`oxlint` 警告の解消（`cd packages/web && bun run lint`）
- 不要な `console.log` 削除
- 写真 alt 属性が空のものを洗い出してシリーズ名+連番で補完
- OGP メタタグの確認

### S1（サイト品質向上: 改善の余地があるとき）

- アニメーション・トランジションのカクつき
- テキストの折り返し・行間・字間のバラつき
- 画像のアスペクト比・object-position のズレ
- ローディング中のレイアウトシフト（CLS）
- 依頼導線の自然な強化

### S4（体験レンズ: 一巡したらローテーション）

1. 初見ユーザーの目線でサイト全体を操作する
2. デザイン設定（グレイン・アクセントカラー・余白）が正しく反映されるか確認
3. 写真100枚超でのギャラリー・Lightbox の動作確認
4. 管理画面でアップロード→シリーズ割り当て→公開の一連操作

## コマンド

```sh
# 型チェック（tsc --noEmit は0ファイル検査の罠。必ず -b）
cd packages/web && tsc -b

# ビルド確認
cd packages/web && bun run build

# lint
cd packages/web && bun run lint

# テスト
cd packages/web && bun test ./src

# git push（Railway が自動デプロイ）
git add -A && git commit -m "..." && git push
```

## コンテキスト節約ルール

- タスク切り替え時は `/clear` してから次に進む
- テストやビルドのログは全文ではなくエラー部分だけ使う（例: `bun test 2>&1 | grep -A 5 -E "FAIL|ERROR|failed" | head -120`）
- 実装フェーズでは `/model sonnet` に切り替えてトークン節約、設計判断が必要な場面では `/model opus` に戻す

## §0 チェック（実装完了ごと）

- [ ] `withRetry` — 新規 DB クエリは全てラップ
- [ ] `assertOk` — 全書き込みレスポンスをチェック
- [ ] settings 4箇所同期 — 新規 settingsキー追加時のみ
- [ ] `Content-Encoding` 手動設定なし
- [ ] `tsc -b` + `bun run build` 通過
