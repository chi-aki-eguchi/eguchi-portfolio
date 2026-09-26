import { isServiceOwnerSite } from "./service-visibility";

/** Owner's photography brief. Do not turn it into promises on customers' sites. */
export const PHOTOGRAPHY_INQUIRY = {
  title: "人物・アーティスト写真の撮影をご検討の方へ",
  intro: "プロフィール写真、アーティスト写真、ポートレートや作品撮りのご相談は、このフォームからお知らせください。撮りたいイメージがまだ固まっていなくても、写真を使う場面から相談できます。",
  questions: [
    {
      q: "最初の相談には、何を書けばよいですか？",
      a: "写真の用途、希望時期、撮影場所、人数、予算の目安を、分かる範囲でお知らせください。SNS・Web・告知物など、使う予定の媒体もあると相談を進めやすくなります。未定の項目は未定のままで構いません。",
    },
    {
      q: "撮りたい雰囲気をうまく言葉にできません。",
      a: "このサイトで気になった作品のURLや、活動内容が分かるページを添えてください。「自然な表情を残したい」「新しい活動のプロフィールに使いたい」といった、写真を必要とする理由だけでも大丈夫です。",
    },
    {
      q: "料金や納期を知りたいときは？",
      a: "撮影内容、場所、写真の使用範囲、必要な点数、希望納期を添えてご相談ください。衣装・ヘアメイク・スタジオなどが必要な場合も、希望や手配状況をお知らせください。実施できる内容と条件を確認しながら進めます。",
    },
  ],
} as const;

export function photographyInquiryFor(siteUrl: string | undefined, english = false) {
  return !english && isServiceOwnerSite(siteUrl, undefined) ? PHOTOGRAPHY_INQUIRY : null;
}
