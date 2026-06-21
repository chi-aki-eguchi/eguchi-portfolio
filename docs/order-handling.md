# 申し込み対応の手順（秋くん用・内部メモ）

申し込み（メール / SNS / 将来は Stripe）が来たときに、迷わず同じ手順で対応するための
runbook です。買う人向けの文面は [purchase-thankyou.md](./purchase-thankyou.md) に、
セットアップ手順は [setup-guide.md](./setup-guide.md) にあります。ここはその「順番」だけ。

## 共通

- 申し込みが来たら、まず簡単に台帳に記録（名前 / コース / 日付 / 状態）。後で楽になります。
- 返信は早めに一言だけでも。「確認しました、これから進めます」で十分です。

## A. 自分で立てる（¥10,000）

買った人が自分で立てるので、こちらの作業は最小です。

1. 入金（または申し込み）を確認。
2. [purchase-thankyou.md](./purchase-thankyou.md) の **A** の文面を送る
   （Deploy リンク + [post-deploy-guide.md](./post-deploy-guide.md) + 連絡先）。
3. 質問が来たら、つまずきの多くは「公開URLを作る（手順④）」か「パスワード」。
   [faq.md](./faq.md) / [post-deploy-guide.md](./post-deploy-guide.md) を案内。
4. 状態を「完了」に。

## B. おまかせ設定（¥30,000）

こちらで立てて渡します。

1. 入金（または申し込み）を確認。
2. [purchase-thankyou.md](./purchase-thankyou.md) の **B** の文面を送り、次を集める：
   - お名前（表記） / 載せたい写真 / プロフィール文 / 連絡先・SNS / 独自ドメイン（あれば）
3. [setup-guide.md](./setup-guide.md) の **方法1（Railway テンプレート）→「担当者が立てる場合」**
   の手順で構築。`ADMIN_PASSWORD` はこちらで決める（または本人希望）。
4. 初期設定（サイト名・プロフィール・写真1枚・トップ写真）を入れて、
   [setup-guide.md](./setup-guide.md) の **公開前チェック** を通す。
5. 本人に渡す（受け渡しチェックリスト↓）。
6. 状態を「完了」に。フォローの一言を添えると印象が良いです。

### 受け渡しチェックリスト（おまかせ）

- [ ] サイトURL
- [ ] 管理画面URL（`/admin/login`）と決めたパスワード
- [ ] [photographer-guide.md](./photographer-guide.md)（本人向けの使い方）
- [ ] 「困ったら連絡してね」の一言（IG / X / メール）

## 将来（Stripe 自動化後）

- Stripe Payment Link を2つ発行（自分で / おまかせ）したら、サイトの `/service` の
  ボタン定数（`STRIPE_SELF` / `STRIPE_CONCIERGE`）を実URLに差し替える。
  → ボタンが自動で Stripe 決済に切り替わり、「準備中」表示も消えます。
- Stripe の「決済後ページ / 確認メール」に [purchase-thankyou.md](./purchase-thankyou.md)
  の A・B を設定すると、入金後の一次返信が自動になります。
- それでも、おまかせの構築・受け渡しは手作業のままでOK（件数が増えたら見直し）。
