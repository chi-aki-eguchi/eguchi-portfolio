import ProfilePage from "./profile";
import ContactPage from "./contact";

/**
 * 新しい構成の Info（2026-10-10、第1段階）。
 *
 * 自己紹介（今までの About）と、料金・依頼（今までの Contact）を1ページに続けて出す。
 * 中身は今までのページそのもの：設定・料金・よくある質問・送信・計測は何も変えていない。
 * `/about` と `/contact` も今までどおり開ける（外からのリンク先を無くさない）。
 * 1つのページとして組み直すのは次の段階。
 */
export default function DevelopInfoPage() {
  return (
    <div className="dv-info">
      <ProfilePage />
      <ContactPage />
    </div>
  );
}
