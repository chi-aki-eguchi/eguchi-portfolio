# 設置・固定版・復旧の実務

この手順の自動ツールは**ローカル専用**です。任意のクラウドURLや本番`.env`を受け付けません。商用環境の復元が済んだという証明にはしません。

## ローカル見本を動かす

前提: Bun、Node 22、PostgreSQL 17。MacのPostgreSQLはHomebrew版を使用。既存のサービスは起動・停止せず、`scratch/kit-delivery/postgres` に別クラスタを作り、127.0.0.1:56430だけで待ち受けます。Bunの `.env` 自動読み込みを切ります。

```sh
bun install --frozen-lockfile
bun run build
bun --no-env-file scripts/kit/local.ts init sample
bun --no-env-file scripts/kit/local.ts serve sample
```

新規のDB・独立したローカルS3互換保存先・サイト別ランダム認証。既存ポートは使いません。サイト5599、保存5598、復元版5699/5698。公開クラウドには接続しません。停止は起動した端末でCtrl+C。DB・作品は残ります。秘密を含む `access.json` とクラスタはGit管理外・権限0600/0700。起動ログにパスワードを出しません。

見本素材は `materials/sources.json` のURL・権利表示・SHA256に従い用意し、`seed.ts` を実行。完了済みのseedは何も書かず、途中失敗時は既存の写真IDを再利用します。途中に手動編集した場合は先に差分を確認します。顧客素材を使うときはこの架空見本用seedを転用しません。

## 顧客の環境を作る前の契約確認

顧客の環境名・サイトID・DB名・バケット名・名義・請求上限・公開先を記録し、既存個人サイトと異なることを確認。新規の有料デプロイ・DNS・認証構成変更は対象を示して承認を受けます。セットアップは担当者が実施。顧客の契約版・製品版を固定し、`main`への自動追従を使いません。

新規の顧客環境では `UPLOAD_DEFAULT_VISIBILITY=private` と `PRIVATE_MEDIA_ACCESS=1` を設定します。後者は画像本体・サムネイルの認証と公開状態をキャッシュより前に検証し、画像のレスポンスをno-storeにします。`R2_PUBLIC_URL`との併用は起動時に拒否します。バケット自体が非公開であることはクラウド側でも別に確認します。新しく登録する写真だけが非公開になり、本人が選んで公開します。既存サイト・既存写真の公開状態は変えません。バケットは非公開にし、公開オブジェクトURLを案内しません。`servicePageMode=off`、クレジットの表示条件を合意して設定、本人の名前・サイトURL・OG・問い合わせ・解析を確認します。

## 固定配布版

```sh
bun --no-env-file scripts/kit/release.ts pack HEAD
bun --no-env-file scripts/kit/release.ts activate 完全なcommitID sample
```

`pack` はtracked差分があると拒否します。Git archiveから `.env` や個人素材を含まない正確なcommitのソースを展開し、lockfileで依存を入れ、ビルドします。manifestにソースtar・全ソース・ビルドのSHA256、migration一覧を記録。`activate` は一致を検証し、サイト単位の起動先を固定します。再起動してhealthのbuildと一致を確認します。Gitのmainが進んでもこの起動先は変わりません。

クラウドはこの検証済みcommitから作ったイメージdigestか固定版ブランチを指定し、環境別の自動デプロイ設定まで確認して初めて固定済みと記録します。今回のクラウド実行は未承認・未実施。

## バックアップと復元

ブラウザー内の本をJSONで書き出し、対象サイトの `projects/` へ置く。全ての編集端末について確認する。次にアプリを停止して、画像とDBが変化しない時間帯で取得します。

```sh
bun --no-env-file scripts/kit/local.ts backup rehearsal-01
bun --no-env-file scripts/kit/local.ts restore rehearsal-01
bun --no-env-file scripts/kit/local.ts restore rehearsal-01 --apply
bun --no-env-file scripts/kit/local.ts serve restored
bun --no-env-file scripts/kit/verify.ts restored
```

初回restoreは検証のみ。対象は空の専用DBと空の画像・作品集フォルダに限定。保存先や既存データを上書きしません。チェックサム不一致なら適用前に停止します。DBはpg_dump custom形式・transaction付きpg_restore。画像、作品集JSON、版のmanifestを組で保管。資格情報、カメラ原本、未書き出しのブラウザー作品集は含みません。復元先ではサイトURLと個別認証を設定し直します。問い合わせの実送信は承認した捕捉先で別途確認します。

復元後は枚数だけでなく、全写真ID・参照URL・文章・設定（復元先URLを除く）・シリーズ所属・画像SHA256・JSON・ログイン・PDF再編集を照合します。途中失敗のバックアップはmanifestが完成していなければ無効。別の新しいラベルで取り直します。復元途中に失敗した環境は公開せず、原因と段階を保存して担当者が確認します。データを自動削除してやり直しません。

同じMacのコピーは独立した災害対策ではありません。商用運用では別アカウント／別保存先への暗号化コピー、保存期間、失敗通知、担当者を合意してから「バックアップ付き」と案内します。案: 1日1回、7日分＋週次4回、週1回の成功点検、版更新前のスナップショット。これは未採用の運用案でSLAではありません。

## 更新と戻し

変更内容・対応DB・migrationを確認→バックアップ→別環境へ復元→新しい固定版で起動→基本操作と画像・設定を照合→承認した更新時間に適用→healthと画面確認。失敗時は直前の固定版へ戻します。

プログラムだけのrollbackはDBを巻き戻しません。今回の変更はschema変更なし。過去の破壊的migrationを含む更新では、旧プログラムが新DBを読めるか検証するか、停止してDB・画像を対のバックアップから復元します。戻す間に増えたデータを無断で捨てません。

## 秘密を含まない顧客台帳

非公開保存先に `siteId / owner / infrastructureOwner / productCommit / artifactDigest / contractVersion / paymentState / productionState / lastBackupSuccess / lastRestoreVerification / nextAction`。メール・カード情報・秘密を一般解析やpublic repoへ入れません。既存opsの受付IDと照合し、通知失敗を重複相談として扱いません。

## 終了

依頼→本人確認→最終請求の照合→持ち出しの受領確認→公開停止→合意した保持期限→削除確認。ドメイン移管は公開環境の削除と別作業。運営者が継続できない場合も、顧客が契約アカウントとデータを回収できる連絡経路を納品カードに残します。
