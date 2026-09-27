/** Local review desk. Only explicit public sample artifacts are served; never the lab directory. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { portfolioPlans } from '../../packages/web/src/shared/portfolio-product';
import { lab, root, free } from './local';
const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const downloads: Record<string, string> = {
 '/guide.md': join(root, 'docs/photographer-guide.md'),
 '/delivery.md': join(root, 'docs/delivery/customer-pack.md'),
 '/operations.md': join(root, 'docs/delivery/operations.md'),
 '/conditions.md': join(root, 'docs/delivery/cost-and-approval.md'),
 '/screen.pdf': join(lab, 'evidence/sample/screen.pdf'),
 '/print.pdf': join(lab, 'evidence/sample/print.pdf'),
};
await free(5799);
Bun.serve({ hostname: '127.0.0.1', port: 5799, fetch(req) {
 const path = new URL(req.url).pathname;
 const file = downloads[path];
 if (file) return new Response(readFileSync(file), { headers: { 'content-type': path.endsWith('.pdf') ? 'application/pdf' : 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
 if (path !== '/') return new Response('Not found', { status: 404 });
 const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Portfolio Kit | 納品見本</title><style>
 *{box-sizing:border-box}body{margin:0;background:#f6f5f1;color:#242421;font-family:system-ui,sans-serif;line-height:1.9}main{max-width:1080px;margin:auto;padding:44px 24px}h1{font-family:serif;font-weight:400;font-size:clamp(30px,5vw,58px);line-height:1.4}h2{font-weight:500;font-size:25px}p{max-width:740px}a{color:inherit;text-underline-offset:5px}small{color:#68675f}section{margin:48px 0;border-top:1px solid #cbc9c0;padding-top:25px}.plans{display:grid;grid-template-columns:1fr 1fr;gap:36px}.price{font-size:32px}li{margin:8px 0}.links{display:flex;gap:24px;flex-wrap:wrap}img{max-width:100%;height:auto}@media(max-width:640px){.plans{grid-template-columns:1fr}}
 </style><main><small>PORTFOLIO KIT / LOCAL DELIVERY REVIEW</small><h1>作品のあるサイトを受け取り、<br>自分の手で育てていく。</h1><p>写真と文章を設定したポートフォリオサイトと、自分で更新できる管理画面をお渡しする提供方式です。このページは今回の実装・納品リハーサルの確認用。新しい契約条件や保守サービスの販売開始を意味しません。</p>
 <div class="links"><a href="http://127.0.0.1:5599/">完成見本を見る →</a><a href="http://127.0.0.1:5599/admin">見本を更新する →</a><a href="http://127.0.0.1:5699/">バックアップから戻した見本 →</a></div>
 <section><h2>LAND / ARCHIVE</h2><p>顧客用構成の説明用見本です。Ansel Adams / National Park Serviceの公的アーカイブ写真を使用。実際の顧客や受注実績ではありません。個人サイトのDB・画像保存先・認証から分離しています。</p><p>写真の追加・並べ替え・公開状態、プロフィール、既存のデザイン設定を変更できます。取り込んだ写真は非公開から始まり、本人が公開します。管理用パスワードは担当者から別の安全な経路で受け取ります。</p></section>
 <section><h2>現在の提供プラン</h2><div class="plans">${portfolioPlans().map(p=>`<article><h3>${escape(p.name)}</h3><div class="price">¥${p.price} <small>税込・一回</small></div><p>${escape(p.intro)}</p><ul>${p.items.map(x=>`<li>${escape(x)}</li>`).join('')}</ul></article>`).join('')}</div><p>69,800円は総額。30,000円を加算しません。サーバー・ドメインの実費は別途、契約前に確認します。任意9,800円/月は作品差し替え作業で、24時間監視や包括的な保守を意味しません。初期登録量・修正・納期・保守と復元の範囲を条件確認書で合意してから支払いへ進みます。</p></section>
 <section><h2>納品と更新の資料</h2><div class="links"><a href="/guide.md">受取人ガイド</a><a href="/delivery.md">納品カード・連絡文の下書き</a><a href="/operations.md">設置・版更新・復元手順</a><a href="/conditions.md">原価と承認事項</a></div><p>PDF作品集は現在の試作範囲で利用できます。ブラウザー保存とJSON書き出し、画像のバックアップを組み合わせます。自由配置・同期・印刷製本の完成は約束していません。</p><div class="links"><a href="/screen.pdf">送信用PDF見本</a><a href="/print.pdf">印刷用PDFデータ見本</a></div></section>
 <section><h2>相談から利用開始まで</h2><p>用途の確認 → 内容・総額・継続実費・条件の提示 → 合意 → 決済事業者側での入金照合 → 素材と掲載許可の確認 → 初期設定 → 本人の確認と公開承認 → 納品 → 本人による基本更新の確認。</p><small>この確認ページから決済・送信は行いません。クラウド公開、正式条件、第三者の操作、実機・紙の確認、実売上は技術検証と別に確認します。</small></section></main></html>`;
 return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
}});
console.log('Review desk: http://127.0.0.1:5799/ (loopback only)');
