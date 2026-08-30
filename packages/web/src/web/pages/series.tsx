import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "../components/PageTitle";
import { api, jsonOrThrow } from "../lib/api";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { SeriesGrid, type ShelfKind } from "../components/SeriesGrid";

/**
 * 作品群の一覧。棚は2つ（2026-08-30）——`series` と `work`。
 * **ページは1つのまま**で、どの棚を出すかだけを受け取る。見た目・列数・札の
 * 作りを二重に持つと、片方だけ直して食い違う。
 */
export default function SeriesListPage({
  kind = "series",
}: {
  kind?: ShelfKind;
}) {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const entranceRef = usePageEntrance([data, kind]);
  // シリーズ側の見出しは従来どおり固定。Work は名前を設定で変えられる
  // （棚を何と呼ぶかは、その人の作品の呼び方だから）。
  const heading = kind === "work" ? (data?.navLabelWork || "Work") : "Series";

  return (
    <section className="max-w-5xl mx-auto site-page site-page-top pb-16 md:pb-32 min-h-[60vh]" ref={entranceRef}>
      <PageTitle className="mb-16 md:mb-24">{heading}</PageTitle>

      <SeriesGrid kind={kind} />
    </section>
  );
}
