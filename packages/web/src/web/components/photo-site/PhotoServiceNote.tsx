import { isServiceOwnerSite } from "../../../shared/service-visibility";

/**
 * フッターのポートフォリオ制作の入口（写真中心のサイト、2026-09-26）。
 *
 * オーナー「メニューからはフッターへ。でももっとオシャレに、気になってクリックしてみたく
 * なるものに。『ポートフォリオ制作』で検索してたどり着けるように」。
 * 見ている人がいま触っているこのサイトそのものが見本、という一言で誘う。広告の帯には
 * しない（太字・矢印・色の地を使わない）。どのページのフッターにも同じリンクが
 * 「ポートフォリオサイト制作」の言葉で入るので、検索からもサイト内からもたどれる。
 *
 * 配布先（購入者）のサイトには出さない（StudioBridge と同じ判定）。
 */
export function PhotoServiceNote({ siteUrl, language = "ja" }: { siteUrl?: string; language?: "ja" | "en" }) {
  if (!isServiceOwnerSite(siteUrl, undefined)) return null;
  const en = language === "en";
  return (
    <aside className="ps-service" aria-label={en ? "Portfolio websites" : "ポートフォリオサイト制作"}>
      <a className="ps-service__main" href={en ? "/portfolio-kit/en" : "/portfolio-kit"}>
        <span className="ps-service__title font-ja">
          {en ? (
            "Portfolio websites for photographers"
          ) : (
            <>
              <span className="ps-service__line">写真家のポートフォリオサイトを、</span>
              <span className="ps-service__line">作っています。</span>
            </>
          )}
        </span>
        <span className="ps-service__lead">
          {en
            ? "This site is built the same way: every photograph in its own shape, arranged by you."
            : "このサイトと同じ仕組みで。写真は元の形のまま、並べ方は自分で選べます。"}
        </span>
        <span className="ps-service__go">{en ? "About portfolio websites" : "ポートフォリオサイト制作について"}</span>
      </a>
      {!en && (
        <a className="ps-service__sub" href="/tools/photo-select-bin.html?from=portfolio">
          写真セレクト便（撮った写真を、選んでもらう道具）
        </a>
      )}
    </aside>
  );
}
