# Adobe Portfolio 比較監査の再確認（2026-09-17）

元の監査: `akieguchi_adobe_portfolio_audit_2026-09-17.md`（固定版 `1ef90fc`。リポジトリ外の資料として
受け取ったもので、原文は変更していない）。依頼: `claude_code_akieguchi_handoff.md`。
ここは、第1段階の各指摘を現行コードで確かめた判定と根拠、監査の訂正を残す一時点の記録。

## 判定

判定の意味: 現存＝固定版にも作業開始時のHEAD（同じ `1ef90fc`）にも残っていた / 解決済み / 仕様どおり / 未検証。
行番号は `1ef90fc` のもの。

| 指摘 | 判定 | 根拠 | 再現 | 対応（`audit/stage1-fixes`） |
|---|---|---|---|---|
| B-01 複製で撮影日時・元ファイル情報が落ちる | 現存 | `packages/web/src/api/index.ts:2168` の insert に `shotAt`・`shotAtSource`・`shotAtDigitized`・`sourceWidth`・`sourceHeight`・`sourceFormat`・`cameraMake`・`cameraModel` が無い | 隔離APIテストを修正前のルートで実行すると7件失敗（撮影日時が null、由来が legacy に戻る） | `8dfdff2` |
| B-03 プレビューのページ選択に Work と作品詳細が無い | 現存 | `admin-settings-preview-pane.tsx:61-64` の選択肢は5つ。`admin-shared.ts` の `buildPublicSiteHref` も5つに固定 | 設定のプレビューで Work・作品を選べない | `72554f8` |
| B-04 作品詳細APIだけ公開用の絞り込みが無い | 現存（範囲は監査より広い） | `index.ts:2818` が `photoWithThumbs` のまま。**`/hero-photos`（`index.ts:3088`）も全列を読み、元ファイル情報と保存キーを返していた** | 同じ fixture で `/api/series/:slug` 39,589 bytes（一覧は 27,823） | `95f0843` |
| B-05 Work のエラー画面が Series へ戻す | 現存 | `series-detail.tsx:123,141` が `/series` 固定、`:138` が「シリーズ」固定 | `/work/:slug` の404・通信失敗で「← Series」 | `7a18fe7` |
| B-06 設置リンクの扱い（README と DISTRIBUTION.md） | 現存 | `README.md:14` buyer-only。`DISTRIBUTION.md:16-18` は 2026-07-18 からオーナー専用。`docs/setup-guide.md`・`post-deploy-guide(-en).md` も購入者自身の設置を案内 | — | `4b033f9` |
| B-06 アップロード上限 | 現存 | `docs/api.md:55` 60MB、`shared/upload-limits.ts:1` 300MB | — | `4b033f9` |
| B-06 AVIF/WebP の有効条件 | 現存 | `docs/api.md:28` は環境変数。実装は `fmt` と Accept で常に出し分け | — | `4b033f9` |
| B-06 写真一覧の初期モード | 現存 | `docs/admin-guide.md:17,109` は「選択」。`admin.tsx:2141` は `"normal"`（閲覧、`024430a`） | — | `4b033f9` |
| 運用: 更新前後の確認が Gallery の写真に固定 | 現存 | `docs/template-update-guide.md:42,100`、`template-release-notes.md` の各版 | 本番は公開写真133枚がすべて Series/Work にあり、Gallery は空 | `4b033f9` |

## 監査の訂正・補足

- **本番buildとの一致:** 監査時は未照合。2026-09-17 に `/api/health` の build が `1ef90fc1` で、固定版と一致した。
- **B-04 の範囲:** 「シリーズ詳細APIだけ」ではなく、トップの写真（`/hero-photos`）も同じ問題を持っていた。
  後者は一覧の列定義も使っておらず、`shotAtDigitized` など一覧に含めない元ファイル情報まで返していた。
- **B-02 の前提:** 公開データでは同じ画像を使う写真は0件（非公開・ゴミ箱は未確認）。複数作品への掲載は
  まだ使われていない。
- **F-01・F-03・B-02 の改善案と確定方針:** `docs/specs/site-and-data-direction.md`（2026-08-14 オーナー確定）は
  §2 で版管理・限定リンク・アクセス制御を「作らない・再提案しない」、§4-2 で多対多の表を作らないと決めている。
  監査はこの文書に触れていない。第2段階の設計（`docs/specs/publishing-and-placement-2026-09-17.md`）は、
  この衝突を先に示し、実装前にオーナーの判断を求める形にした。
- **B-06 の販売条件:** 監査の対象外だが、`docs/faq.md` と `docs/sales-page.md` の「24時間以内」「3日以内」が
  2026-09-06 の運用文書と食い違う。販売条件なので変更せず、`docs/agents/backlog.md` B-28 に残した。

## 未検証

- PostgreSQL（配布版）での実行。複製・公開応答の変更はスキーマを変えない drizzle の読み書きだが、
  この環境に PostgreSQL が無く、実行して確かめていない。
- 本番の管理画面・スマホ実機での操作。確認はローカルのブラウザー（Playwright の Chromium、人工データ）と jsdom。
- 監査 §5 の見た目・速度の比較、§6 の問い合わせの実送信（今回は扱っていない）。

## 追記: 隔離した smoke での再検証（2026-09-17、検証したコミット `86f65e2`）

smoke は実行ごとの一時SQLite・人工データ（`packages/web/src/test-fixtures/smoke-site.ts`）・127.0.0.1 の
偽ストレージ・テスト専用パスワードで動くようにした（`scripts/smoke/isolated-server.ts`、backlog B-29）。
ブラウザは Playwright 1.61 の Chromium（desktop・mobile・Pixel 7）と WebKit（iPhone 13）。PostgreSQL・実機・本番は使っていない。

| 項目 | UI をモックで確認 | 実 API ＋ 隔離DB で確認 | 未検証 |
|---|---|---|---|
| B-01 複製 | なし（書き込みは smoke で止める） | `photo-duplicate.api.test.ts`（実APIを子プロセスで起動、10件） | PostgreSQL、管理画面から複製する操作 |
| B-03 プレビュー | `admin-settings-preview.spec.ts`（PC・375px・取得失敗→再読み込み）、jsdom の描画テスト（空・削除・非公開化・読み込み中） | `audit-stage1-real-api.spec.ts`（実際の一覧、非公開は選べない、符号化が要る slug、iframe と公開リンクの一致、写真0枚、PC・375px） | 表示中に作品を削除・非公開にする操作（書き込みのため jsdom で確認）、本番の管理画面 |
| B-04 公開応答 | なし | `public-photo-response.api.test.ts`、`audit-stage1-real-api.spec.ts`（開発サーバー経由） | PostgreSQL、本番の応答サイズ |
| B-05 失敗時の戻り先 | jsdom の描画テスト（両方の棚で正常・404・通信失敗・空・再試行） | `audit-stage1-real-api.spec.ts`（404 は実API、通信失敗は route.abort で再現し再読み込みで実APIから表示、写真0枚、次の作品へ遷移、PC・375px） | 本番 |
| B-06 文書 | — | `docs-contract.test.ts`（静的） | 公開サイト側の案内 |

最終結果（`86f65e2`）: `bun run check` 成功（製品1433件・ツール60件・smoke の番人34件、型・lint・build）。
全体 smoke 726件のうち成功542・スキップ171・**失敗13**（全体成功ではない）。遮断プロキシが止めた228件は
すべて WebKit から Google Fonts 2宛先への先行接続（想定外0件）。記録は worktree の
`scratch/smoke-evidence/2026-09-17T05-15-23-111Z/` と `scratch/audit-stage1-20260917/final-86f65e2/`。

### 残る13件（いずれも変更前にも同じ条件で起きる）

`1ef90fc` に安全対策（`7bd685c`）だけを載せた環境で同じ13件を実行し、失敗した要素・受け取った値まで一致した
（`scratch/audit-stage1-20260917/baseline-13/`）。第1段階の5項目の検証には使っていない spec で、
5項目の確認結果に影響しない。

| spec（project） | 失敗の内容 | 分類 |
|---|---|---|
| admin-contact-settings-validation:271（desktop） | spec 自身の「想定外の通信」に `/api/photos/availability` が入る | 2026-09-16 `d82d461` でナビが件数APIを読むようになり、spec のモック一覧が未追従 |
| admin-library-modes:163（desktop） | 検索中の「並べ替え」が無効でなく、有効で「解除して並べ替える」 | 2026-09-13 `208c1e1`/`2031c56` の意図した動作（単体テスト `admin-reorder-lock.render.test.tsx` が確認）に smoke が未追従。空DBの実行では成功扱いだった（理由は未特定） |
| admin-library-modes:16・:292、admin-library-selection:20（mobile） | スマホ幅で `[data-library-mode-action="select"]` や選択モードが見つからない | スマホの閲覧時は別の「選択」ボタン（`data-library-mobile-select`）になっている（画面の記録で確認）。selection:20 は helpers.ts の `gotoAdminTab(…, "select")` がこのボタンを押さないため選択に入れない。:16・:292 は「写真2枚未満ならスキップ」で、空DBでは隠れていた |
| admin-library-contact-sheet:63（mobile・mobile-touch・mobile-safari） | 「PCで」の検査がスマホ幅でも走り、並べ替えの入口が見つからない | spec に project の指定が無い（2026-09-13 `1991751` で追加。desktop では成功） |
| admin-workspace-layout:37・:103（desktop） | 畳んだナビのフォーカスが移らない／開いたナビの幅が 216px（期待 240px） | 原因は未調査（寸法・フォーカスの期待と現行の差。2026-09-13 の再設計以降の変化と推定）。既存の S-2 と同じ spec |
| admin-form-layout:196（desktop） | 目次の幅が期待より 16px 違う | 寸法の期待値との差。原因は未調査 |
| admin-i18n:7（desktop） | 写真編集の「詳細」を押せずに時間切れ | 原因は未調査（押す位置が他の要素に覆われている可能性） |
| admin-selected-button:55（mobile） | スマホ幅の写真編集で選択中の区分ボタンが非表示 | 原因は未調査 |

スキップ171件の多くは spec が対象外の端末幅・project を飛ばす指定。人工データの量で飛ぶと分かっているのは
`admin-debug-sweep:195`（人工データの写真27枚のうち一覧に出る25枚では、一覧の仮想表示が動かない）。
