# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-08-12 JST

- **Status:** Admin問い合わせ設定の検証を実装完了（オーナー確認・commit判断待ち）
- **Current owner:** Codex / Sol / **Handoff readiness:** ready
- **Branch:** `main` / **HEAD:** `d6dd5b8` / **Git:** dirty（共有の既存差分を保護） /
  **originとの差:** なし（実測）

### 目的と完成状態

- 壊れたメールアドレスやフォーム送信先を、保存・セットアップ完了・公開のどこでも使わない。
- 空欄は連絡手段を非表示にする有効な設定とし、前後空白は保存・利用前に除去する。
- 互換フォームサービスを許可するためFormspreeドメインには固定せず、HTTPS URL構文だけを共通基準にする。

### 今回完了した変更

- `shared/contact-settings.ts` を追加。一般的なメール形式、資格情報・fragmentなしのHTTPS URL、trim、公開用safe値を一元化。
- Settingsはメール=`email`、送信先=`url`。無効な変更は保存APIを呼ばず、日英inline文・`aria-invalid`・説明連結・対象入力focusを出す。
- desktopの保存パネルと390pxの下部保存バーを同じ検証経路へ統一。空欄保存と、旧不正値があっても無関係な設定だけを保存する互換性を維持。
- `/api/admin/settings` はUI迂回の不正な連絡先キーをDB書込み前に400 / `invalidKeys`で拒否し、値をtrimして保存する。allowlist・atomic write・retryは維持。
- 「はじめに」は実際に使えるメールまたはHTTPS送信先だけを「連絡先」完了とする。
- 公開ContactとService側は旧DBの不正値をform POST・mailtoへ渡さず、メール/SNS fallbackを維持。Lunaの重複送信lock・focus・retry・honeypot・日英は保持。
- B-14は現物で解消済みのため製品を変えずbacklogから削除した。

### B-14再測定の範囲

- ローカル人工API・書込み遮断、1440px/light/通常ロード済みで写真タイルは265×265px、透明、影なし、角丸なし、overflowなしを実測。
- 768px / 390px / dark / 選択 / 詳細 / 空 / 読込み途中はB-14判断のためには未測定。全面マトリクス確認済みとは扱わない。

### 検証済み

- shared/API wiring/Contact render/Setup render focused: 35 pass / 0 fail。
- 人工API + POST遮断browser: 1440px JA/light と390px EN/darkで、無効値POST 0、valid trim payload、空欄削除、focus/ARIA、横あふれなし、透明・shadowなしのinline文を確認。
- 旧不正値＋無関係Settings保存、公開Contactの不正form/mailto非表示とSNS fallbackをbrowserで確認。
- 負の確認: 390px下部Saveを旧直呼びへ一時的に戻すとinline検証が失敗し、`saveSettings`復元後に通過。
- `bun run check` 成功（typecheck / lint / test / tools / build）。`bun run smoke` は473 test entriesで最終`status=passed`、failedTestsなし。

### 変更範囲 / 次の一手 / 境界

- 今回: contact shared helper・API wiring・Settings/Setup/公開Contact/Service・render/browser回帰、`docs/agents/backlog.md`、`task.md`。
- 共有dirtyには既存のLibrary・公開JP/EN・Luna Contact差分も同居。巻戻し・上書きしない。
- オーナーが共有差分を確認し、必要ならcommitする。Codexはcommit / push / deployしない。
- 本番DB / Turso / R2 / Railway / 環境変数 / 外部Formspree は未操作。本番は未反映。
- local commit: なし / push: なし / Railway反映: なし / 本番確認: 未commit変更のため未反映。
- Codex session: `/root/terra_admin_library_audit`
<!-- CURRENT_STATE_END -->

---

## 過去記録

過去 Handoff（133本）と過去 Current State は `docs/archive/task-handoffs.md` へ移した。
**このファイルには Current State だけを置く。**履歴を戻さない。
新しい Handoff が必要なときは、archive 側の末尾へ追記する。
