# 決済後コンテンツ（Stripe Payment Links 用）

Stripe Payment Link の「支払い後に表示するページ（After payment → Confirmation page →
カスタムメッセージ）」または「確認メール」に載せる文面です。コースごとに2種類。

> リンクの差し替え:
> - Deploy リンク（自分で立てる）: `{{BUYER_ONLY_DEPLOY_LINK}}`
> - 購入後スタートページ: <https://akieguchi.com/portfolio-kit/start>
> - Deploy リンクは購入者向けの案内内だけに載せる。公開ページには置かない。
> - 連絡先: Instagram @chi._.aki._ ／ X @chi_aki_jpg ／ akieguchi33@gmail.com

---

## A. 自分で立てる（¥10,000）— 支払い後メッセージ／メール

```
ご購入ありがとうございます。「自分で立てる」コースです。

下の手順で、あなたのポートフォリオサイトを公開できます。10〜15分ほどです。

1. まず、管理画面に使うパスワードを1つ決めておきます（8文字以上・メモを）。

2. 購入後スタートページを開きます:
   https://akieguchi.com/portfolio-kit/start

3. 決済後24時間以内に届く案内メールの「Deploy」リンクから公開します:
   {{BUYER_ONLY_DEPLOY_LINK}}

4. 流れはこの順番です:
   パスワードを入れる → Deploy → 公開URLを作る（Generate Domain） →
   /admin/login でログイン → 管理画面の「はじめに」から写真を入れる

5. 操作方法の相談が含まれます（当面は期間・回数の制限なし）。分からないことがあればいつでもご連絡ください。
   Instagram @chi._.aki._ ／ X @chi_aki_jpg ／ akieguchi33@gmail.com

※ サイトの公開には Railway という場所を使います。無料の試用枠のあと、
  使った分の実費（小さなサイトで月500〜1,000円程度）がかかります。
  デプロイ中にカード登録を求められたら、想定どおりの動きです。

どうぞ、よい撮影と公開を。
```

---

## B. おまかせ設定（¥30,000）— 支払い後メッセージ／メール

```
ご購入ありがとうございます。「おまかせ設定」コースです。

決済後24時間以内に、素材のお願いをメールでお送りします。
素材が揃ってから3日以内に設定し、サイトURL と 管理画面のパスワードをお送りします。

スムーズに進めるため、よければこのメールへの返信で、次を教えてください
（あとからでも大丈夫です）:

  ・お名前（サイトに出す表記）
  ・載せたい写真（数枚でも／あとで増やせます）
  ・プロフィール文・連絡先・SNSアカウント
  ・使いたい独自ドメイン（あれば。なくてもOK）

操作方法の相談は、当面は期間・回数の制限なく受け付けます（今後、期間制に
変更する可能性があります）。デザイン変更・作業の代行は、内容に応じて別途お見積もりします。ご連絡は、このメールへの返信かSNSへお願いします。
   Instagram @chi._.aki._ ／ X @chi_aki_jpg ／ akieguchi33@gmail.com

サイトが整ったら、すぐに写真を入れ始められるようにしてお渡しします。
購入後スタートページはこちらです:
https://akieguchi.com/portfolio-kit/start
```

---

## English A. Self setup (¥10,000) — confirmation message / email

```
Thank you for purchasing Aki Eguchi Portfolio Kit — Self setup.

You can publish your portfolio in about 10–15 minutes with the steps below.

1. Choose one password for the admin panel (at least eight characters) and keep
   it somewhere safe.

2. Open the English start guide:
   https://akieguchi.com/start/en

3. Within 24 hours of payment, I will email your private Deploy link and the
   next steps:
   {{BUYER_ONLY_DEPLOY_LINK}}

4. The setup order is:
   enter your password → Deploy → Generate Domain → add /admin/login to the
   public URL → open 「はじめに」 (Getting started) and add your first photograph.

5. Guidance on using the admin panel is included — currently unlimited. Support
   is provided in Japanese and simple English. You can reply to this email or use:
   Instagram @chi._.aki._ / X @chi_aki_jpg / akieguchi33@gmail.com

The admin panel is available in English and Japanese — switch anytime with the JP | EN toggle.

Railway hosts the site separately from Portfolio Kit. Its prices can change and
are based on usage; a small portfolio is usually inexpensive to run. If Railway
asks for a payment card during setup, that is an expected part of activating its
hosting service.

Wishing you a good edit, and a good place for the work to live.
```

---

## English B. Assisted setup (¥30,000) — confirmation message / email

```
Thank you for purchasing Aki Eguchi Portfolio Kit — Assisted setup.

Within 24 hours of payment, I will email you with a short request for the
materials needed to prepare the site. Once all requested materials are ready,
your site will be delivered within three days. The handover includes the public
site URL, admin URL, and admin password.

To begin, please reply with the following when convenient:

  - The name you want displayed on the site
  - The photographs you want to begin with (a small selection is enough)
  - Profile text, contact details, and social links
  - A custom domain, if you already have one (it is fine not to have one)

Guidance on everyday use of the site and admin panel is currently unlimited
(this may become time-limited in the future). Design changes and custom work are
quoted separately. Support is provided in Japanese and simple English. You can reply to
this email or use:
Instagram @chi._.aki._ / X @chi_aki_jpg / akieguchi33@gmail.com

The admin panel is available in English and Japanese — switch anytime with the JP | EN toggle.

English start guide:
https://akieguchi.com/start/en
```

---

## メモ

- Stripe では Payment Link ごとに確認ページ／メールの文面を設定できます。コースを
  2つ（自分で／おまかせ）に分けているので、それぞれに上の A・B を入れてください。
- `{{BUYER_ONLY_DEPLOY_LINK}}` は Stripe の購入後画面・購入後メール・個別連絡でだけ
  実際の link に差し替えてください。公開ページや README には入れない。
- 「自分で立てる」の公開ページには Deploy リンクを直接置かない。Deploy リンクは決済後の
  メッセージまたは個別連絡だけに載せる。
- 文面は固定でも動きますが、購入者の名前を差し込めるなら冒頭を「◯◯さん、ありがとう
  ございます」にするとより丁寧です。
- 英語版はオーナーが手動で送り分ける。判断しづらい場合は、日本語版と英語版を同じ
  メールに併記してよい。
