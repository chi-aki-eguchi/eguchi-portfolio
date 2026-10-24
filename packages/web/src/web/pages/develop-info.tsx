import ProfilePage from "./profile";
import ContactPage from "./contact";
import { useInitialHashScroll } from "../hooks/useInitialHashScroll";
import { DEVELOP_INQUIRY_ANCHOR } from "../../shared/develop-structure";
// Info の中での余白の調整はここ（直接このページを開いても読み込まれるように、ここで読む）。
import "../components/develop/develop.css";

/**
 * 新しい構成の Info（2026-10-10 第1段階、2026-10-13 に並びを組み直し）。
 *
 * 扉から来た人が探すのは料金と依頼。短い自己紹介 → 料金と依頼 → note の記事・プリント
 * の順に出す（以前は自己紹介のすぐ後に note の記事が入り、料金まで スマホで3画面ぶん送る必要が
 * あった）。中身は今までのページそのもの：設定・料金・よくある質問・送信・計測は何も変えていない。
 * 続けて出すための調整：自己紹介の末尾の「お問い合わせ」への案内を出さない（すぐ下にフォームが
 * ある）、依頼の見出しを h2 にする（1ページに h1 は1つ）。
 * `/about` と `/contact` も今までどおり開ける（外からのリンク先を無くさない。並びも今までどおり）。
 *
 * 撮影のご依頼の帯・フッターの「お問い合わせ」は `/info#request` へ来る（2026-10-24）。
 * 料金と依頼の頭に印を置き、そこから見せる（自己紹介はその上に残る）。
 */
export default function DevelopInfoPage() {
  // 料金は取り寄せを待って描かれるので、届くまでの間は印へ合わせ直す（useInitialHashScroll の説明）。
  useInitialHashScroll({ followLayoutMs: 1500 });
  return (
    <div className="dv-info">
      <ProfilePage embedded part="intro" />
      <div id={DEVELOP_INQUIRY_ANCHOR} className="dv-info__request" aria-hidden="true" />
      <ContactPage embedded />
      <ProfilePage embedded part="more" />
    </div>
  );
}
