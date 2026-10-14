(() => {
  const KEY = "portfolio:offline-auto-retry";
  const COOLDOWN_MS = 30_000;
  let busy = false;
  let reloading = false;
  let lastProbeAt = -Infinity;
  const page = window.location.pathname + window.location.search;

  function reload() {
    if (reloading) return;
    reloading = true;
    // Reload the failed URL, including query/hash, rather than returning to /.
    window.location.reload();
  }

  document.getElementById("retry")?.addEventListener("click", (event) => {
    event.preventDefault();
    reload();
  });

  async function recover() {
    if (busy || reloading || document.visibilityState === "hidden" || navigator.onLine === false) return;
    // Without storage we cannot guard against a reload loop across documents.
    // Manual retry still works; do not auto-reload in that environment.
    if (Date.now() - lastProbeAt < 1000) return;
    let previous;
    try {
      previous = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (previous?.page === page && Date.now() - previous.at < COOLDOWN_MS) return;
    } catch {
      return;
    }
    busy = true;
    lastProbeAt = Date.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
      // Online events alone do not prove that the site's server has recovered.
      if (response.ok && (response.headers.get("content-type") || "").includes("application/json")) {
        await response.json();
        // Guard reloads, not failed probes: an online/visible event after a
        // failed health check should be allowed to retry when the server returns.
        sessionStorage.setItem(KEY, JSON.stringify({ page, at: Date.now() }));
        reload();
      }
    } catch {
      // Remain on the useful retry page. No polling or unhandled rejection.
    } finally {
      window.clearTimeout(timeout);
      busy = false;
    }
  }

  window.addEventListener("online", recover);
  document.addEventListener("visibilitychange", recover);
  void recover();
})();
