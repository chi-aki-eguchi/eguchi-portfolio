import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";
import App from "./app.tsx";
import { api, jsonOrThrow, prefetchSettings } from "./lib/api";
import { ADMIN_DEMO_PREVIEW_PARAM } from "./lib/admin-demo-data";
import { installAdminDemoFetch } from "./lib/admin-demo-fetch";

const demoPreviewSeed = new URLSearchParams(window.location.search).get(
	ADMIN_DEMO_PREVIEW_PARAM,
);
if (demoPreviewSeed) installAdminDemoFetch(demoPreviewSeed);

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Avoid refetch-on-every-navigation flicker for largely static content
			staleTime: 60_000,
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});

void prefetchSettings(queryClient);

// 先読みも本文を読む前に応答を検証する（`jsonOrThrow`）。ここだけ素の
// `.json()` だったため、APIが500を返すと `{error: "..."}` がそのまま
// ["photos"] のキャッシュに入っていた。staleTime が60秒あるので、後から
// 描画するギャラリーはそれを新鮮なデータとして使い、再取得もエラー表示も
// せずに「No photos」と出す。写真が消えたようにしか見えないうえ、
// 再読み込みのボタンも出ない。gallery.tsx 側には ContentStatus による
// 「取得に失敗した」経路が用意されているので、先読みが投げれば正しく
// そちらへ落ちる。
const initialPath = window.location.pathname;
if (initialPath === "/gallery") {
	// Warm categories only for gallery. Other routes don't need this endpoint.
	queryClient.prefetchQuery({
		queryKey: ["categories"],
		queryFn: async () => jsonOrThrow(await api.categories.$get()),
		staleTime: 5 * 60_000,
	});
	queryClient.prefetchQuery({
		queryKey: ["photos"],
		queryFn: async () => jsonOrThrow(await api.photos.$get()),
	});
}
if (initialPath === "/") {
	// Warm hero-photos alongside the home chunk so the top page hero renders with
	// the correct photos on first paint without making every route download it.
	queryClient.prefetchQuery({
		queryKey: ["hero-photos"],
		queryFn: async () => jsonOrThrow(await api["hero-photos"].$get()),
	});
}

if ("serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker.register("/sw.js").catch(() => {});
	});
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<Router>
				<App />
			</Router>
		</QueryClientProvider>
	</StrictMode>,
);
