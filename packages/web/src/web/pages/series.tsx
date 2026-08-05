import { useQuery } from "@tanstack/react-query";
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
    <section className="max-w-5xl mx-auto px-6 md:px-12 pt-[calc(4rem*var(--spacing-page-top,1))] md:pt-[calc(8rem*var(--spacing-page-top,1))] pb-16 md:pb-32 min-h-[60vh]" ref={entranceRef}>
      <h1
        className="font-en uppercase text-center mb-16 md:mb-24 page-entrance"
        style={{ fontSize: "var(--section-label-size, 0.75rem)", color: "var(--section-label-color)", letterSpacing: "var(--section-label-tracking, 0.10em)", lineHeight: "var(--section-leading, 1.2)" }}
      >
        Series
      </h1>

      <SeriesGrid />
    </section>
  );
}
