import type { AdminDemoSnapshot } from "./admin-demo-data";
/** Disposable, explicitly labelled editing examples. Never inserted into a site's database. */
export function addIntroductionExamples(snapshot: AdminDemoSnapshot) {
  const usedIds = [...snapshot.series.map(s => Number(s.id)), ...snapshot.photos.flatMap(p => [p.seriesId, ...(Array.isArray(p.seriesIds) ? p.seriesIds : [])]).map(Number).filter(Number.isSafeInteger)];
  const firstId = Math.max(0, ...usedIds) + 1;
  const photo = snapshot.photos[0];
  const make = (id: number, slug: string, title: string, blocks: unknown[]) => ({
    id, slug, title, kind: "work", subtitle: "編集して試せる見本", statement: "これは架空の紹介ページです。文章や部品を自由に変えて試せます。", isPublished: true,
    sortOrder: snapshot.series.length + id - firstId, coverPhotoId: id === firstId ? photo?.id ?? null : null,
    content: JSON.stringify({ version: 1, enabled: true, blocks }),
  });
  snapshot.series.push(make(firstId, "introduction-example", "作品と活動の紹介（見本）", [
    { id: "intro", type: "text", heading: "取り組んだこと", text: "ここに作品や活動の背景を書きます。何を大切にし、どんな形にしたのかを、読む人に伝えるための場所です。" },
    ...(photo ? [{ id: "image", type: "image", photoId: photo.id, caption: "画像の説明を添えられます。" }] : []),
    { id: "details", type: "facts", items: [{ label: "担当", value: "企画・制作（記入例）" }, { label: "制作年", value: "2026（記入例）" }] },
    { id: "ending", type: "text", heading: "工夫したこと", text: "画像のあとにも文章を置けます。制作の過程や自分が担当した範囲を、必要な長さで説明してください。" },
  ]));
  snapshot.series.push(make(firstId + 1, "writing-example", "文章で伝える実績（見本）", [
    { id: "context", type: "text", heading: "背景と役割", text: "写真がなくても、実績を紹介できます。どんな状況で、何を任され、どう取り組んだかを書いてみてください。" },
    { id: "result", type: "text", heading: "取り組みから分かったこと", text: "結果だけでなく、判断したことや次に生かせることも伝えられます。" },
    { id: "link", type: "link", label: "掲載先へのリンク（記入例）", url: "https://example.com/", description: "記事や外部サイトで公開している実績へのリンクを置けます。" },
  ]));
  if (photo) {
    const ids = Array.isArray(photo.seriesIds) ? photo.seriesIds : photo.seriesId == null ? [] : [photo.seriesId];
    photo.seriesIds = [...ids, firstId];
  }
  snapshot.settings.navLabelWork = "実績";
  snapshot.settings.siteName = "Your Name";
  snapshot.settings.siteNameEn = "Your Name";
  snapshot.settings.siteDescription = "作品と仕事の紹介を試すための見本です。";
  snapshot.settings.contactIntro = "お仕事のご相談やご質問をお寄せください。";
  snapshot.settings.profileBio = "作品と仕事の紹介を試すための見本です。";
}
