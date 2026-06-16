import { JSDOM } from "jsdom";
import type { Plugin } from "vite";

export default function runableAnalyticsPlugin(): Plugin {
	return {
		name: "runable-analytics-plugin",
		enforce: "pre",
		async transformIndexHtml(html) {
			const dom = new JSDOM(html);
			const doc = dom.window.document;
			const head = doc.head;

			const websiteUrl = process.env.WEBSITE_URL ?? "";
			const hostname = websiteUrl ? new URL(websiteUrl).hostname : "";

			// Runable script
			const script = doc.createElement("script");
			script.defer = true;
			// Absolute path: a relative "./runable.js" resolves against the current
			// route (e.g. /series/x → /series/runable.js → 404 + MIME error) on any
			// nested SPA URL. Root-absolute loads correctly from every page.
			script.src = "/runable.js";
			script.dataset.hostname = hostname;
			script.dataset.url = "https://r.lilstts.com/events";
			if (hostname === "localhost") script.dataset.devmode = "true";
			head.appendChild(script);

			return dom.serialize();
		},
	};
}
