import { isServiceOwnerSite } from "./service-visibility";

/**
 * Contact の「設定が空のときに出る文」。
 *
 * ここには**約束の数字**が入っていた。「通常2〜3日以内にお返事しています」
 * 「1〜2週間でデータ納品」「2〜3日以内にお返事します」。オーナー本人のサイトなら
 * 本人が決めた約束だが、**Portfolio Kit を買った人のサイトにも同じ文が出る。**
 * 買った人は、自分で決めていない納期を自分の名前で約束することになる。
 * 件名の選択肢に混ざっていた「テンプレートについて」も同じで、これは
 * akieguchi.com がテンプレート需要を測るために足したもの（2026-07-08 承認）で、
 * 他人のサイトに出る理由が無い。
 *
 * 2026-07-08 の判断は「出ることを承知で、上書きできるから良し」だった。
 * ここではその判断を見直すが、**akieguchi.com の表示は1文字も変えない。**
 * 出し分けには、Portfolio Kit のページが既に使っている持ち主判定をそのまま使う
 * （新しい仕組みを足さない）。
 *
 * 空にして良いのは note と flow だけ。送信完了文と件名の選択肢は空にすると
 * 画面が壊れるので、中立文へ差し替える。
 */
export type ContactDefaults = {
  contactNote: string;
  contactFlow: string;
  contactSentMessage: string;
  contactSubjectOptions: string;
};

const OWNER: ContactDefaults = {
  contactNote:
    "「まだ決まっていないけれど相談したい」という段階でも歓迎です。通常2〜3日以内にお返事しています。",
  contactFlow:
    "ご相談 → 日程と場所のすり合わせ → 撮影 → 1〜2週間でデータ納品、という流れです。",
  contactSentMessage:
    "お送りいただきありがとうございます。2〜3日以内にお返事します。",
  // 「テンプレートについて」はテンプレート需要の計測用(2026-07-08 承認)
  contactSubjectOptions:
    "Shooting,Press / Media,Collaboration,テンプレートについて,Other",
};

const NEUTRAL: ContactDefaults = {
  // 温度は残し、日数だけ落とす。
  contactNote: "「まだ決まっていないけれど相談したい」という段階でも歓迎です。",
  contactFlow:
    "ご相談 → 日程と場所のすり合わせ → 撮影 → データ納品、という流れです。",
  contactSentMessage:
    "お送りいただきありがとうございます。折り返しご連絡します。",
  contactSubjectOptions: "Shooting,Press / Media,Collaboration,Other",
};

export function contactDefaultsFor(
  siteUrl: string | undefined,
): ContactDefaults {
  return isServiceOwnerSite(siteUrl, undefined) ? OWNER : NEUTRAL;
}
