# eguchi-portfolio-app — AI Rules

オーナーは江口秋。写真家で、コードは読まない。**実物を見て判断する。**

**このチャットでオーナーが言ったことが、この文書より優先される。**

## デザインの仕事では、大きく変えてよい

「デザイン」「レイアウト」「使用感」を変えたいと言われたら、**枝を切って作り直す。**
許可を取り直さない。見た目・並び・語彙・操作の置き場所は全部変えてよい。
`styles.css` の `!important` と多重指定も、まとめて剥がしてよい。

**選択肢を並べて止まるより、作って見せる。**
オーナーはコードを読まないので、差分ではなくスクリーンショットで見せる。

## 止まってオーナーに聞くこと

**この3つだけ。**

- `.env`、APIキー、パスワード、トークンを表示・記録・commit しそうになった。
- 本番DB・Turso・R2・Railway・環境変数・課金・外部公開設定に触る必要がある。
- 消したら戻せないものを消すことになる。

## 検証と push

- 製品コードを変えたら `bun run check`。admin を変えたら `bun run smoke` も。
- 両方通っていて、上の3つに触れていなければ `git push` してよい。push = 本番反映。
- **通っていない検証を「通った」と書かない。**ローカル / commit / push / 本番反映を
  混同しない。どれをやっていないかを書く。
- 戻し方は `docs/rollback-guide.md`（オーナー向け・コピペ可）。

## 製品コードの不変条件

**ここは実際に事故が起きた場所。**守らないと同じ事故が再発する。

- DBクエリは `withRetry(() => db....)` で包む。
- settings の新規キーは4箇所を同期する: `settings-preview.ts` の台帳、
  API `/settings` の default、`provider.tsx` のDB適用 `useEffect`、
  同ファイルの `handlePreviewMessage`。
- 書き込みAPIの応答は本文を読む前に検証する（`assertOk` / `jsonOrThrow`）。
  admin 配下は `admin-shared.ts` 版を使う。素の `res.ok` に置き換えると
  セッション切れが無言で失敗する。
- **settings の保存は必ず `postAdminSettings()` を経由する。** API は許可リスト外の
  キーを黙って無視するため、`assertOk` だけ見ると一部が保存されないまま成功に見える。
- 新しい書き込みには、応答検証に**加えて**失敗が画面に出る経路を必ず付ける。
  検証は例外を投げるだけで、画面に出る保証がない。
- `Content-Encoding` を付けるのは `api/http-compression.ts` だけ。手で付けない
  （2026-06-13 の二重圧縮事故）。HTMLは `Cache-Control: no-store`。
- DB schema変更は `schema.ts` と `schema.postgres.ts` を両方直す。
- データ更新後は該当queryを再取得する。画面を古いまま残さない。
- `eguchi-portfolio-app` と `ivys-house` のコードを混ぜない。

## 記録

- 記録された不具合に着手する前に、**実物を測り直す。**行番号も数値も症状も信じない。
  もう直っていたら、直さずに `docs/agents/backlog.md` から項目を消す。
- 現役の文書に、測り直せる行数・件数を「現在の事実」として書かない。
- 区切りで `task.md` 冒頭の Current State を短く更新する。長く書かない。
- 仕様の索引は `docs/specs/README.md`。`docs/archive/` は通常読まない。
