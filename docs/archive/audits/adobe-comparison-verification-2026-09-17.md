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

### 残る13件（同じ隔離条件で基準コードでも再現。原因確認済8・未調査5）

`1ef90fc` に安全対策（`7bd685c`）だけを載せた環境で同じ13件を実行し、失敗した要素・受け取った値まで一致した
（`scratch/audit-stage1-20260917/baseline-13/`）。第1段階の5項目の検証には使っていない spec。
比較の基準に安全対策を含むため、これは第1段階の製品修正との切り分けであって、ブランチ全体（安全対策を含む）に
回帰が無いことの証明ではない。安全対策の無い `1ef90fc` の smoke は本番につながるため実行していない。
未調査の5件は、テスト側の書体の差し替え（Google Fonts を空で返す）などの影響も除けていない。

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

## 追記: 外部レビュー R1〜R4 の限定修正（2026-09-17、検証したコミット `d6b34aa`）

`ee38df9` の差分レビュー（REVIEW_RESULT.md、ZIP SHA-256 `bec2436d…c829` を対象）で、テスト基盤に4点の指摘があった。
第1段階の製品修正は変えていない。本番・migration・push・mainへの統合・デプロイはしていない。

| 指摘 | 修正（`d6b34aa`、R4 は `5fd840e`） | 再現テスト（`ee38df9` で失敗 → 修正後に成功） |
|---|---|---|
| R1 `page.request`・`context.request`・request fixture は Node から直接送り、`context.route` を通らない | fixtures.ts が context の `fetch` を塞ぎ、request fixture は準備で失敗させる。spec の API 読取は `api`（`smoke-api.ts`: 同一オリジンの `/` パス・GET/HEAD・`maxRedirects: 0`、3xx は失敗）。直接の要求・`route.fetch`・Node からの独自接続は `spec-boundary.test.ts` が書き方でも検出 | `playwright-probes.test.ts` R1: 修正前は別ポートの罠へ GET・POST・fetch の3件が届いた。修正後は0件、同一オリジンの GET は成功。`smoke-api.test.ts` は本物の APIRequestContext で、POST 等が送る前に失敗・リダイレクト不追従を確認 |
| R2 終了時の判定がブラウザ側の記録だけを見て、0件なら終わっていた | 終了時にサーバーがまだ動いているうちに `/__smoke/isolation` を必ず読み、サーバー側の遮断が1件でも・読めなくても・隔離が崩れていても失敗（`egressVerdict`）。テストが全部通っても、その判定で落ちた実行は証拠フォルダを残す | R2: note の取得をサーバー側だけで1件起こす部分実行（smoke-isolation.spec.ts を含まない）。修正前は終了コード0、修正後は失敗し `note.com:443` を記録 |
| R3 実行中テスト名を付けるだけで外さず、終了後の接続も「テスト中」に数え得た | 名前は context を作る前に付け、context を閉じた後に外す（成功・失敗・時間切れのどれでも）。403 の拒否は変えない | R3: 修正前は成功したテストの後の CONNECT にそのテスト名が残った。修正後は開始前・各テストの間・失敗後・時間切れ後・最後の後の CONNECT がすべて名前なし・想定外、テスト本文の CONNECT だけが想定内 |
| R4 `node --test *.test.ts` は Node 22.16 で起動前に失敗（型除去は 22.18 から既定） | `node scripts/smoke/guard/run.mjs`: 22.12〜22.17・23.0〜23.5 は `--experimental-strip-types` を付ける。22.12 未満は理由を出して止める（型除去は 22.6、launcher のテストが起動する Vite 7.3 は 22.12 から）。ファイルは1つずつ動かす | `node-support.test.ts` は版ごとの判定だけ。**Node 22 系での実行は未検証**（この Mac は Node 24.16 だけ。レビュー側で 22.16＋フラグの25件は成功、全46件は未確認） |

結果（`d6b34aa`、Node 24.16）:

- 番人テスト 46件成功（以前34件。R1〜R4 で12件追加）。`bun run check` 成功（製品1433・ツール60・番人46、lint。
  型検査と build は製品コードに変更が無く turbo のキャッシュ再生）。
- 関連 smoke（smoke-isolation・audit-stage1-real-api・usability-review）27件＝成功14・スキップ13・失敗0。
- 全体 smoke 726件＝成功542・スキップ171・**失敗13**（全体成功ではない）。13件は `86f65e2` の13件と
  project・ファイル・行・エラーの先頭まで同じ。終了時の判定は通過: ブラウザ側の遮断228件はすべてテスト実行中の
  Google Fonts 2宛先への先行接続、テストの外の接続0件、サーバー側の遮断0件。
- 記録: worktree の `scratch/smoke-evidence/2026-09-17T11-17-44-504Z/`、`scratch/audit-stage1-20260917/review-r1-r4/`
  （修正前の再現ログ `repro-before-ee38df9.log` を含む）。

残り: Node 22 系での番人テスト、PostgreSQL・実機・本番（従来どおり未検証）。レビューで指摘された
フィルム日時のコメント・テスト名の言い回しのずれ（処理は元値の複写で問題なし）は、今回の R1〜R4 の範囲外として未修正。
公開文書と同じ文字列だったローカル設定の ADMIN_PASSWORD は、利用先を確認していない（本番の漏えいとも無害とも断定しない）。

## 追記: R4 を Node 22 で実行して確認（2026-09-17、検証したコミット `c7dd520`）

公式配布の `node-v22.12.0-darwin-arm64.tar.gz`・`node-v22.18.0-darwin-arm64.tar.gz` を作業用の一時フォルダへ取得し、
nodejs.org の `SHASUMS256.txt` と SHA-256 が一致することを確かめて展開した（GPG 署名は gpg が無く未確認）。
既定の Node（24.16.0）・シェル設定・依存・lockfile・`engines` は変えていない。各版で、環境を空から作り
PATH の先頭をその版にし（`/usr/local/bin` の Node 24 は PATH に入れない）、`.env` を読まずに
`<その版>/bin/node scripts/smoke/guard/run.mjs` を実行した。観測のため、Node の中から版と実行ファイルを書く
プリロード（`NODE_OPTIONS=--import`）と、子孫プロセスの実行ファイルを `lsof`／`ps` で記録する監視を併用した。
番人テスト自体は変えていない。

| 版 | `f1a636c`（修正前） | `c7dd520`（修正後） | 使われた Node |
|---|---|---|---|
| 22.12.0 | 46件すべて成功（`--experimental-strip-types` を付与） | 48件すべて成功 | 入口・各テストファイル・Vite・Playwright の本体と worker はすべて 22.12.0。Node 24 は0件。isolated-server は Bun |
| 22.18.0 | 41成功・5失敗（Playwright を起動する5件） | 起動前に理由を出して終了コード1（テストは実行しない） | 入口・各テストファイル・Vite・Playwright CLI は 22.18.0。Node 24 は0件 |

22.18.0 の5件は、Playwright 1.61 が設定・spec を読む段階の `TypeError: context.conditions?.includes is not a function`。
Node 22.18.0 の `module.registerHooks` は require の解決で `conditions` を Set で渡す（24.16.0 は配列、22.12.0 には
この API が無い）。相対 import を1つ持つだけの最小の spec でも同じく読めず、`1ef90fc` の spec も `./helpers` を
相対 import するので、互換性の問題でありこのブランチの変更や観測の仕組みが原因ではない（main の smoke は実行していない）。
`c7dd520` で、入口がその Node のフックの動きを子プロセスで確かめ、読めない Node では理由を出して止めるようにした
（`node-support.test.ts` に判定と実測の検査を追加）。Playwright・Node の版は変えていない（backlog S-4）。

`c7dd520` で `bun run check`（Node 24.16）も実行した（結果は同じ記録先の `final-c7dd520/`）。smoke の spec・fixture は
変えていないので、全体 smoke は再実行していない（直近は `d6b34aa` の 726件＝成功542・スキップ171・失敗13）。
記録: worktree の `scratch/audit-stage1-20260917/review-r1-r4/`、レビュー用の出力 `scratch/review-audit-stage1-fixes-c7dd520/`。
