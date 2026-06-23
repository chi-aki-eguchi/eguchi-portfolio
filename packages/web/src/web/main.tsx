import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";
import App from "./app.tsx";
import { api } from "./lib/api";

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

// Warm the cache as early as possible — in parallel with the initial page chunk —
// so navigating to the (lazy-loaded) gallery shows categories instantly instead of
// waiting for chunk → mount → fetch. Categories rarely change, so keep them fresh
// for longer. Fire-and-forget; failures are retried by the component's own query.
queryClient.prefetchQuery({
	queryKey: ["categories"],
	queryFn: async () => (await api.categories.$get()).json(),
	staleTime: 5 * 60_000,
});
queryClient.prefetchQuery({
	queryKey: ["settings"],
	queryFn: async () => (await api.settings.$get()).json(),
});
queryClient.prefetchQuery({
	queryKey: ["photos"],
	queryFn: async () => (await api.photos.$get()).json(),
});
// Warm hero-photos alongside photos so the top page hero renders with the
// correct photos on first paint (prevents the gray-placeholder flash).
queryClient.prefetchQuery({
	queryKey: ["hero-photos"],
	queryFn: async () => (await api["hero-photos"].$get()).json(),
});

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
