/** Local sales preview and separate owner evidence. Only explicit sample artifacts are served. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { portfolioPlans, PORTFOLIO_PRODUCT } from '../../packages/web/src/shared/portfolio-product';
import { lab, root, free } from './local';
const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const downloads: Record<string, string> = {
 '/owner.md': join(root, 'output/portfolio-kit-owner/owner-start-here.md'),
 '/offer-review.md': join(root, 'output/portfolio-kit-owner/offer-review-20260928.md'),
 '/search.md': join(root, 'output/portfolio-kit-owner/search-baseline-20260928.md'),
 '/guide.md': join(root, 'docs/photographer-guide.md'),
 '/delivery.md': join(root, 'docs/delivery/customer-pack.md'),
 '/operations.md': join(root, 'docs/delivery/operations.md'),
 '/conditions.md': join(root, 'docs/delivery/cost-and-approval.md'),
 '/screen.pdf': join(lab, 'evidence/sample/screen.pdf'),
 '/print.pdf': join(lab, 'evidence/sample/print.pdf'),
 '/preview.css': join(import.meta.dir, 'review/style.css'),
 '/preview.js': join(import.meta.dir, 'review/client.js'),
 '/preview-theme.js': join(import.meta.dir, 'review/theme.js'),
 '/visual/series.png': join(lab, 'evidence/sample/-series-landforms-desktop.png'),
 '/visual/gallery.png': join(lab, 'evidence/sample/-gallery-desktop.png'),
 '/visual/profile.png': join(lab, 'evidence/sample/-profile-desktop.png'),
 '/visual/site.png': join(lab, 'evidence/sample/--desktop.png'),
 '/visual/mobile.png': join(lab, 'evidence/sample/home-mobile.png'),
 '/visual/editor.png': join(lab, 'evidence/sample/pdf-editor.png'),
 '/visual/page-2.png': join(lab, 'evidence/sample/render-screen/page-2.png'),
 '/visual/page-3.png': join(lab, 'evidence/sample/render-screen/page-3.png'),
 '/visual/demo.webm': join(root, 'packages/web/public/portfolio-kit/admin-demo-ja.webm'),
 '/visual/demo.jpg': join(root, 'packages/web/public/portfolio-kit/admin-demo-video-poster.jpg'),
 '/visual/demo.vtt': join(root, 'packages/web/public/portfolio-kit/admin-demo-ja.vtt'),
};
const types: Record<string,string> = { css:'text/css; charset=utf-8', js:'text/javascript; charset=utf-8', pdf:'application/pdf', png:'image/png', jpg:'image/jpeg', webm:'video/webm', vtt:'text/vtt; charset=utf-8', md:'text/plain; charset=utf-8' };
await free(5799);
Bun.serve({ hostname: '127.0.0.1', port: 5799, fetch(req) {
 const path = new URL(req.url).pathname;
 const file = downloads[path];
 if (file) {
  const body = readFileSync(file);
  const headers: Record<string,string> = { 'content-type': types[path.split('.').at(-1)!] ?? 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options':'nosniff' };
  if (path.endsWith('.webm')) {
   headers['accept-ranges']='bytes';
   const range=req.headers.get('range');
   if (range) {
    const match=/^bytes=(\d+)-(\d*)$/.exec(range);
    const start=match ? Number(match[1]) : -1, end=match?.[2] ? Math.min(Number(match[2]),body.length-1) : body.length-1;
    if(start<0 || start>=body.length || end<start)return new Response(null,{status:416,headers:{'content-range':`bytes */${body.length}`}});
    return new Response(body.subarray(start,end+1),{status:206,headers:{...headers,'content-range':`bytes ${start}-${end}/${body.length}`,'content-length':String(end-start+1)}});
   }
  }
  return new Response(body, { headers });
 }
 if (path !== '/') return new Response('Not found', { status: 404 });
 const plans = portfolioPlans().map((plan, index) => `<article><div class="plan-topline"><span>0${index + 1}</span><span>${index === 0 ? '写真と文章が揃っている方へ' : '選ぶ・書くところから、一緒に'}</span></div><h3>${escape(plan.name)}</h3><p class="intro">${escape(plan.intro)}</p><div class="price">¥${plan.price}<small>税込・一回</small></div><ul>${plan.items.map(item => `<li>${escape(item)}</li>`).join('')}</ul><button type="button" class="button" data-open-consult data-plan="${plan.id}">このプランで相談を考える <span aria-hidden="true">↗</span></button></article>`).join('');
 const html = readFileSync(join(import.meta.dir, 'review/page.html'), 'utf8')
  .replaceAll('__PLANS__', plans)
  .replaceAll('__SETUP_PRICE__', PORTFOLIO_PRODUCT.setupPrice.toLocaleString('ja-JP'))
  .replaceAll('__EDITORIAL_PRICE__', PORTFOLIO_PRODUCT.editorialPrice.toLocaleString('ja-JP'))
  .replaceAll('__CARE_PRICE__', PORTFOLIO_PRODUCT.optionalEditingMonthlyPrice.toLocaleString('ja-JP'));
 return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
}});
console.log('Review desk: http://127.0.0.1:5799/ (loopback only)');
