# 英語対応・JP/EN 切り替え仕様（i18n-en）

> 2026-07-16 オーナー決定「英語を足していく。JP/EN 切り替え。特に Kit 販売を海外向けに整える」
> を受けた段階仕様。親計画: docs/specs/growth-monetization-plan.md §2。
> フル多言語化フレームワークは導入しない（新規ライブラリ禁止 / autonomy-rules）。
> 辞書オブジェクト + 言語スイッチの最小実装で進める。

---

## 全体方針

- 言語は **日本語（既定）と英語** の2つ。それ以外は扱わない
- 翻訳は「直訳」ではなく、販売文と同じトーン（静かで誠実、誇張しない）で書き直す
- **検索エンジンに載せたいページは URL で言語を分ける**（例: `/portfolio-kit/en`）。
  ボタンで表示だけ切り替える方式は、Google からは1言語のページに見えるため
- 実装単位ごとに `bun run check` + 該当ページの render テスト追加（render-smoke-tests の慣習に従う）

## 正直な制約（販売ページに書く・隠さない）

1. **管理画面は現在日本語のみ**。英語版 LP には
   "The admin panel is currently Japanese-first. English admin is on the roadmap."
   のような一文を必ず入れる（買ってから気づかせない）
2. 手順書（post-deploy-guide 等）も日本語のみ → Phase 1 で最小限の英語セットアップ手順を用意
3. サポート言語: 秋さんが英語でどこまで対応できるか。
   "Support is provided in Japanese and simple English." など実態に合わせた表現にする
   → 【秋さん確認】

## 決済（調べて分かっていること）

- 既存の Stripe Payment Link は円建てのまま **海外カードで支払える**（Stripe が換算する）。
  Phase 1 では決済リンクを増やさず、英語 LP に "Prices are in JPY (≈ USD表示は目安)" と書く
- USD 建てリンクの追加は Phase 3 判断（為替・振込手数料・価格見え方の問題が出てから）

---

## Phase 1 — Kit 販売の英語化【最優先・これだけで海外販売可能】

**対象ファイル**: `packages/web/src/web/pages/service.tsx`（販売LP）/
`service-start.tsx`（購入後スタートページ）/ `app.tsx`（ルート追加）/
`server.ts`（OGP・sitemap）

1. ルート `/portfolio-kit/en`（および `/service/en` 相当の既存エイリアス方針に従う）を追加。
   既存 LP と同じコンポーネントを言語 prop / 辞書で切り替える
2. LP 全文の英語版（コース A/B/C、FAQ、購入の流れ、24時間以内案内・3日以内納品の約束、
   買い切り条件、上記「正直な制約」）
3. JP/EN 切り替えを LP・スタートページ両方の右上に置く（2026-07-16 オーナー決定。
   URL で言語が分かれるため、切り替え = 対応する言語版 URL への相互リンク）
4. 購入後スタートページ `/start` の英語版（`/start/en`）と、購入後メール文面の英語版を
   docs/purchase-thankyou.md に併記（送り分けはオーナー手動 — 購入者の言語は Stripe の
   国情報や氏名で判断できないため、最初は日英併記メール1通でもよい → 【秋さん確認】）
5. SEO まわり: 両ページに `hreflang`（日英ページが対であることを検索エンジンに伝えるタグ）、
   英語版 OGP タイトル/説明、sitemap への追加（server.ts の既存注入・生成に乗せる）
6. 最小の英語セットアップ手順: docs/post-deploy-guide の要点だけの英語版1枚
   （docs/post-deploy-guide-en.md）。全訳はしない

**完了の定義**: `/portfolio-kit/en` が本番相当ビルドで表示され、JP/EN 相互リンクが機能し、
hreflang/OGP が正しく出て、`bun run check` + render テスト成功。配布先テンプレートでは
既存の servicePageMode 制御にそのまま従う（英語版だけ出る、は起きない）。

## Phase 2 — 管理画面の EN/JP 切り替え【2026-07-16 オーナー決定で前倒し】

海外購入者が実際に触るのは管理画面。ここが英語になると「日本語のみ」の
注意書きを外せて、Kit の海外販売が本物になる。デモ管理画面（/admin/demo）も
同じ辞書で英語化されるため、海外の見込み客が買う前に英語で試せる。

- **言語の持ち方**: 管理画面は検索エンジン対象外なので URL 分離は不要。
  画面右上の JP | EN トグルで切り替え、選択はブラウザ保存（localStorage）に持つ。
  **新しい settings キーは追加しない**（§0 の4箇所同期を増やさないため）
- **辞書方式**: ラベルは型付き辞書モジュール（ja/en 対）に集約。文字列の直書き置換はしない。
  訳語はカメラ・写真用語の慣例に合わせる（例: 絞り=Aperture、並び順=Sort order）
- **段階（丁寧に、一気にやらない）**:
  - **2a**: ログイン・共通シェル（ナビ・ヘッダー・保存/キャンセル等の共通ボタン）・
    はじめにチェックリスト・デモ管理画面のバナーとガイド
  - **2b**: 写真管理（アップロード・一括編集・ライブラリ）・シリーズ・カテゴリ管理
  - **2c**: 設定タブ（140以上の設定ラベルと説明文）— 最大の山。タブ単位で分割実装
- 各段階で render テスト + `bun run smoke`（admin に触れるため必須）
- 完了後、英語 LP の "Japanese-first admin" 注意書きを
  "Admin panel available in English and Japanese" に差し替える

## Phase 3 — 公開サイトの JP/EN（依頼導線）

- 対象: ナビ・プロフィール・お問い合わせの3点のみ（ギャラリーの写真タイトル等は対象外）
- プロフィール英語文は settings に `profileTextEn` 系キーを追加して管理画面から編集可能にする
  → **§0 の settings 4箇所同期を厳守**。キー追加は着手時に個別リストを作る
- 言語切り替えはヘッダーに JP | EN。選択は URL（`/en/about` など）を正とする
- お問い合わせフォームに "English inquiries welcome" を常時表示（切り替え前でも見える位置）

## Phase 4 — 海外購入者が実際に現れてから

- 手順書（post-deploy-guide 等）の全訳、USD 決済リンク、英語サポートテンプレート
- （管理画面英語化は Phase 2 へ前倒し済み）

---

## 秋さんが決めること

1. Phase 1 着手 GO / 修正
2. 購入後メールは「日英併記1通」か「英語版を送り分け」か
3. 英語サポートの範囲の一文（実態に合わせる）
4. 英語 LP に載せる名前表記（Aki Eguchi で確定か）

## 実装順

**Phase 1**: LP 英語文面 → ルート+辞書実装 → OGP/hreflang/sitemap →
スタートページ+メール文面 → render テスト → check → Handoff
**Phase 2**: 2a → 2b → 2c の順に、各段階で check+smoke を通してから次へ。
体制: 実装=Codex（gpt-5.6-sol / reasoning ultra、2026-07-16 オーナー指示）、
レビュー=Claude（リスク階層別、docs/agents/codex-workflow.md に従う）
