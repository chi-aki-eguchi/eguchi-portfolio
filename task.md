# Task Log

<!-- CURRENT_STATE_START -->
## Current State — 2026-09-05 JST

- **Status:** 分散していた公開済み・未公開の作業をmainへ統合。普段の作業台はこの1つ。
- **Current owner:** Codex / **Handoff readiness:** ready
- 写真詳細ページと検索対象の選別、HERO画像の配信改善、公開画面の日英対応、
  個人情報を含めないアクセス計測、管理画面保存後の公開キャッシュ更新を統合。
- 公開済みのStudio導線・管理画面を主役にしたPortfolio Kit販売ページを保持。
- 予約やIvyの設定は別リポジトリ。Portfolioの写真原本・本番DB・決済設定を変更していない。
- Privacy・サイト利用条件は日英で用意。未採用の販売条件は
  `docs/specs/portfolio-kit-sales-policy-draft.md` に保管し、公開ページへ掲示しない。
  未採用案を理由に全サイトの購入導線を止める固定フラグも除いた。
- 写真追加中は共通フッターとStudio案内を末尾へ先出ししない。ギャラリーの最後で表示する。
  Escで新しく開いた確認画面を、同じキーの既定動作で閉じないようにした。
- 本番確認で写真詳細の初回表示が透明なままになる問題を検出。API取得後に
  表示処理を開始し、初回アクセス時の画像と親要素の不透明度をブラウザーで検証する。
- `AGENTS.md` を作業方針の正本とし、通常の改善は検証後のcommit・push・本番確認まで進める。
  PM2設定を読んだだけでDB変更・buildは実行しない。

### 検証と公開状態の確認

- `bun run check`、全体smokeと失敗箇所の修正後の再検証を実施。
  全体smokeの最初の失敗も記録し、成功として置き換えない。
- 本番は <https://akieguchi.com/>。`/api/health` のbuildとGit HEADを照合する。
  本番反映の実測・検証ログは同日の開発記録と統合レポートを参照。

### 保管した作業

- `prototype/b2-uneven-rows`: 2026-07-28時点の段違い行レイアウト試作。未統合。
- `prototype/finder-contact-sheet`: 2026-07-28時点のFinder風一覧試作。未統合。
- 統合済みworktree3つと完了ブランチを整理。個別設定・検証資料・AI履歴は
  `~/.local/share/worktree-archives/2026-09-05/` へ保存し、移動前後を照合済み。
- 販売条件の未確定項目は相談用資料に残る。通常の製品改善を止める条件にしない。
<!-- CURRENT_STATE_END -->

統合前の詳細: [2026-09-05の統合前記録](docs/archive/task-before-2026-09-05-integration.md)。
過去の記録: `docs/archive/task-handoffs.md`。
