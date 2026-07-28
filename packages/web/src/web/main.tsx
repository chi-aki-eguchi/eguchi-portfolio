import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";
import App from "./app.tsx";
import { api, prefetchSettings } from "./lib/api";
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

const initialPath = window.location.pathname;
if (initialPath === "/gallery") {
	// Warm categories only for gallery. Other routes don't need this endpoint.
	queryClient.prefetchQuery({
		queryKey: ["categories"],
		queryFn: async () => (await api.categories.$get()).json(),
		staleTime: 5 * 60_000,
	});
}
if (initialPath === "/gallery") {
	queryClient.prefetchQuery({
		queryKey: ["photos"],
		queryFn: async () => (await api.photos.$get()).json(),
	});
}
if (initialPath === "/") {
	// Warm hero-photos alongside the home chunk so the top page hero renders with
	// the correct photos on first paint without making every route download it.
	queryClient.prefetchQuery({
		queryKey: ["hero-photos"],
		queryFn: async () => (await api["hero-photos"].$get()).json(),
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
