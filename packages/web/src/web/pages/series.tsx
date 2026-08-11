import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "../components/PageTitle";
import { api, jsonOrThrow } from "../lib/api";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { SeriesGrid } from "../components/SeriesGrid";

export default function SeriesListPage() {
  const { data } = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
  });
  const entranceRef = usePageEntrance([data]);

  return (
    <section className="max-w-5xl mx-auto site-page site-page-top pb-16 md:pb-32 min-h-[60vh]" ref={entranceRef}>
      <PageTitle className="mb-16 md:mb-24">Series</PageTitle>

      <SeriesGrid />
    </section>
  );
}
