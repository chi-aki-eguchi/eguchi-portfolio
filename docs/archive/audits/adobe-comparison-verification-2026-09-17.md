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
