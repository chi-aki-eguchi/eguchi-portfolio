import { isServiceOwnerSite } from "../../../shared/service-visibility";
import { JaPhrases } from "../JaPhrases";

/**
 * フッターのポートフォリオ制作の入口（写真中心のサイト、2026-09-26）。
 *
 * オーナー「メニューからはフッターへ。…『ポートフォリオ制作』で検索してたどり着けるように」。
 * 見ている人がいま触っているこのサイトそのものが見本、という一言で誘う。
 *
 * 2026-09-29: 見出し・説明・リンクの3段を、フッターの1行へ。どのページでも作品を
 * 見終えた直後に出るので、作品の後ろで宣伝の節にならない大きさにする。
 * リンクの言葉「ポートフォリオサイト制作」は検索とサイト内の導線のため保持。
 *
 * 2026-10-07: 出すのは About だけ（`isAboutRoute`）。作品のページの終わりを
 * 「撮影のご依頼」1つにするため。出すページは呼ぶ側（Layout）が決める。
 *
 * 配布先（購入者）のサイトには出さない（StudioBridge と同じ判定）。
 */
export function PhotoServiceNote({ siteUrl, language = "ja" }: { siteUrl?: string; language?: "ja" | "en" }) {
  if (!isServiceOwnerSite(siteUrl, undefined)) return null;
  const en = language === "en";
  return (
    <aside className="ps-service" aria-label={en ? "Portfolio websites" : "ポートフォリオサイト制作"}>
      <p className="ps-service__lead">
        {en
          ? "I also build portfolio websites for photographers, on the same system as this site."
          : <JaPhrases>このサイトと同じ仕組みで、写真家のポートフォリオサイトを作っています。</JaPhrases>}
      </p>
      <a className="ps-service__go" href={en ? "/portfolio-kit/en" : "/portfolio-kit"}>
        {en ? "Portfolio websites" : "ポートフォリオサイト制作について"}
      </a>
      {!en && (
        <a className="ps-service__sub" href="/tools/photo-select-bin.html?from=portfolio">
          写真セレクト便
        </a>
      )}
    </aside>
  );
}
