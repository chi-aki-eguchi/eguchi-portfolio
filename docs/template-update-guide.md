# 配布先サイトの更新手順

対象: Railway テンプレート（`DATABASE_PROVIDER=postgres`）から作った、
納品済みサイトのセットアップ担当者。

写真家本人は操作しません。サイトURL、写真、文章、管理画面の設定を残したまま、
GitHub の最新版へ更新するための手順です。通常は **約10分** です。

用語メモ:

- デプロイ: GitHub のプログラムから、Railway 上で新しいサイト本体を組み立てること。
- commit: GitHub 上のプログラムの版を見分ける番号。
- マイグレーション: 写真や設定を消さず、データベースの形を新しい版へ合わせる処理。
- ロールバック: 問題が出たとき、直前に動いていたプログラムへ戻す操作。

## 更新前に確認するもの（1分）

1. [template-release-notes.md](./template-release-notes.md) の一番上を開く。
2. `10分更新: 可` と書かれていることを確認する。
3. `目標commit` の8文字をメモする。
4. 更新する写真家の **公開サイトURL** と **管理画面パスワード** を用意する。

`10分更新: 不可` または記載がない版は、この手順で進めません。

DBマイグレーションがある版は、**その版の更新履歴に「更新前に必ずやること」が
書かれている場合にかぎり**この手順で進められます。書かれていなければ「不可」です。
（2026-08-17 追記: この条件を満たす版が初めて出たので、規則の書き方を
「原則不可」から「バックアップ手順があれば可」へ具体化した。判断の中身は変えていない
— 原則が求めていた「版ごとのバックアップ・復旧手順」が、版の側に用意されたということ。）

**目標commitが履歴の一番上と合わない場合は、更新せずに止めてください。** 手順書は
「最新のmainを配る」形なので、履歴が実際のmainより古いと、更新が成功したのか失敗したのか
判定できません（2026-07-16 から 2026-08-17 まで、実際にこの状態でした）。

## 10分更新

### 1. 更新前のサイトを確認する（1分）

公開サイトを別タブで開き、次の3点だけ確認します。

- トップに写真が表示される
- `/gallery` に既存写真がある
- `/admin/login` の画面が開く

続けて、公開サイトの末尾に `/api/health` を付けて開きます。`build` がすでに
`目標commit` と一致していれば更新済みです。以降の更新操作はせず、手順4の表示確認だけを
行います。

問題があれば更新せず、先にその問題を記録します。更新前からの問題と、更新で起きた問題を
混同しないためです。

### 2. 正しいRailwayサービスか確認する（1分）

1. Railway で、その写真家の project を開く。
2. **サイト本体のサービス**を開く。Postgres や Storage は開かない。
3. **Settings → Source** で次を確認する。
   - Service Source または Upstream Repo: `chi-aki-eguchi/eguchi-portfolio`
   - Branch: `main`（または Default branch と表示）
4. **Variables** で `DATABASE_PROVIDER` が `postgres` になっていることを確認する。
5. **Settings → Deploy** で Healthcheck Path が `/api/health` になっていることを確認する。

ここでは値を変更せず、確認だけにします。`Ejected` や別のRepositoryが表示される場合、
配布先専用のGitHubコピーへ切り離されています。勝手に接続先を変えず、Railwayの
upstream update通知を使うか、保守担当へ相談します。

### 3. GitHubの最新版をデプロイする（3〜6分）

まずRailway project上部に **Update available** などのテンプレート更新通知がないか
確認します。通知がある場合は、release notesの最新更新を読むボタンから確認してから、
通知に従って更新を適用します。Railwayテンプレートの標準更新経路なので、こちらを
優先します。目標commitとの一致は、更新後に手順4で確認します。

通知がなく、手順2でService Sourceが `chi-aki-eguchi/eguchi-portfolio` の `main` に
直接つながっていることを確認できた場合だけ、次の操作をします。

1. Railway 画面で **Command Palette** を開く。
   - Mac: `⌘ K`
   - Windows: `Ctrl K`
2. `Deploy Latest Commit` を検索して選ぶ。
3. サイト本体のサービスを選び、確認画面で実行する。
4. **Deployments** を開き、新しい行が `Active` / `Success` になるまで待つ。
5. ログを開き、次の行を確認する。
   - `[migrate] PostgreSQL schema is up to date.`
   - 赤い `FAILED` / `Crashed` がない

> **押し間違い注意:** 過去のdeploymentにある `Redeploy` は、選んだ古い版をもう一度
> 組み立てる操作です。最新版への更新にはなりません。必ず `Deploy Latest Commit` を
> 使います。

起動時の `runStartupMigrations()` は、まだ適用していないPostgreSQL更新だけを実行します。
適用済みの更新は記録されるため、再起動しても同じ処理を重ねません。失敗した場合は
新しいサイト本体が起動せず、healthcheckが通るまで以前の版が公開側に残ります。

### 4. 更新できたことを確認する（2分）

1. 公開サイトの末尾に `/api/health` を付けて開く。
2. `status` が `ok` になっていることを確認する。
3. `build` の先頭8文字が、release notes の `目標commit` と一致することを確認する。
4. 公開サイトを再読み込みし、次を確認する。
   - トップと `/gallery` に更新前の写真が残っている
   - サイト名・プロフィール・色などの設定が残っている
   - `/admin/login` からログインできる
5. release notes の「更新後の確認」を見る。

確認中は、写真の追加・保存・削除はしません。表示とログインだけを確認します。

## 失敗したとき

### 新しいdeploymentが `Failed` / `Crashed` になった

新しい版は公開されていない可能性が高いので、まず公開サイトが表示できるか確認します。
ログの `[migrate]` から始まる行と、エラー画面のスクリーンショットを保存し、保守担当へ
渡します。Variables、Postgres、Storageは自分で変更しません。

### 新しい版が `Active` だが、表示に問題がある

1. サイト本体 → **Deployments** を開く。
2. 直前に成功していたdeploymentの `…` を押す。
3. `Rollback` を選び、確認画面で実行する。
4. 以前の版が `Active` になったら公開サイトを再確認する。

**注意:** Railway のRollbackが戻すのはプログラムと環境変数です。すでに適用された
DBマイグレーションは元に戻りません。このため、release notes が `10分更新: 可` の版だけを
この手順で扱います。写真や設定を手作業で削除してはいけません。

## 保守担当者のリリース条件

配布先へ案内する前に、保守担当者は次を完了させます。

- `main` に確定済みの変更だけを置き、目標commitをrelease notesへ記録する
- `cd packages/web && tsc -b`
- `cd packages/web && bun test ./src`
- `cd packages/web && DATABASE_PROVIDER=postgres bun run build`
- PostgreSQLマイグレーションの有無を確認する
- DBマイグレーションが1件でもある版は原則 `10分更新: 不可` にする。配布先ごとの
  バックアップと復旧検証まで用意した版だけ、個別手順で例外を判断する
- 捨ててもよいRailway projectで build → migrate → `/api/health` を確認する
- 更新後に見る箇所をrelease notesへ3項目以内で書く

新しいsettingsキーの既定値は、既存の `site_settings` の保存内容を上書きしません。
新しいDBマイグレーションは `drizzle-postgres/` に追加し、過去のSQLは編集しません。

## Railway公式資料

- [Template Updates](https://docs.railway.com/templates/updates) — 配布済みtemplateへの更新通知
- [Deployment Actions](https://docs.railway.com/deployments/deployment-actions) —
  `Deploy Latest Commit`、`Redeploy`、`Rollback` の違い
- [Healthchecks](https://docs.railway.com/deployments/healthchecks) —
  新版がHTTP 200を返してから公開先を切り替える仕組み
