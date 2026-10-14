// 案内ページ（offline.html）の自動復帰。sw.js がページを開けなかったときに、元の住所のまま
// この案内を返す。サイトが応答するようになったら、その住所を1回だけ開き直す。
//  - 開き直すのは /api/health が答えたときだけ（online の合図だけでは、サイトが戻ったとは限らない）
//  - 同じ住所を30秒以内に2度は自動で開き直さず、合わせて3回までにする（ページだけが
//    失敗し続けるときの往復を防ぐ）
//  - 問い合わせは間隔を空けて数回まで。見えていない間は問い合わせない
(() => {
  const KEY = "portfolio:offline-auto-retry";
  const COOLDOWN_MS = 30_000;
  const MAX_AUTO_RELOADS = 3;
  const PROBE_TIMEOUT_MS = 5000;
  const BACKOFF_MS = [2000, 5000, 10_000, 20_000, 40_000];
  const page = location.pathname + location.search + location.hash;
  const status = document.getElementById("status");
  const reason = document.getElementById("reason");
  // Retry-After の時刻（sw.js が meta で渡す）。これより前はサイトに問い合わせない。
  let notBefore = Number(document.querySelector('meta[name="retry-not-before"]')?.getAttribute("content")) || 0;
  let attempt = 0;
  let timer = 0;
  let busy = false;
  let reloading = false;

  const say = (text) => {
    if (status) status.textContent = text;
  };

  function reload() {
    if (reloading) return;
    reloading = true;
    window.clearTimeout(timer);
    // 元の住所（query・hash も）を開き直す。トップへは戻さない。
    location.reload();
  }

  document.getElementById("retry")?.addEventListener("click", (event) => {
    event.preventDefault();
    reload();
  });

  // 自動で開き直してよいか。"wait" は少し置けばよい、"stop" はもう自動では開き直さない。
  function reloadGate() {
    try {
      const previous = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (previous?.page !== page) return { ok: true, count: 0 };
      if (previous.count >= MAX_AUTO_RELOADS) return { ok: false, stop: true };
      if (Date.now() - previous.at < COOLDOWN_MS) return { ok: false, stop: false };
      return { ok: true, count: previous.count || 0 };
    } catch {
      // 覚えておけない環境では往復を防げないので、自動では開き直さない（ボタンは使える）。
      return { ok: false, stop: true };
    }
  }

  function schedule() {
    window.clearTimeout(timer);
    if (attempt >= BACKOFF_MS.length) {
      say("自動の確認を止めました。つながったら「もう一度読み込む」を押してください。");
      return;
    }
    timer = window.setTimeout(probe, Math.max(BACKOFF_MS[attempt], notBefore - Date.now()));
    attempt += 1;
  }

  async function probe() {
    if (busy || reloading) return;
    if (document.visibilityState === "hidden") return; // 戻ってきたときに確かめる
    if (Date.now() < notBefore) {
      // online・表示の合図でも、指示の時刻より早くは問い合わせない（確認の回数も使わない）。
      window.clearTimeout(timer);
      timer = window.setTimeout(probe, notBefore - Date.now());
      return;
    }
    if (navigator.onLine === false) {
      if (reason) reason.textContent = "この端末がインターネットにつながっていないようです。つながると自動で開き直します。";
      return; // online の合図を待つ
    }
    const gate = reloadGate();
    if (!gate.ok) {
      if (gate.stop) {
        say("自動では開き直せませんでした。少し置いて「もう一度読み込む」を押してください。");
        return;
      }
      schedule();
      return;
    }
    busy = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    let healthy = false;
    try {
      const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
      healthy = response.ok && (response.headers.get("content-type") || "").includes("application/json");
      const after = response.headers.get("retry-after")?.trim();
      if (!healthy && after) {
        const at = /^\d+$/.test(after) ? Date.now() + Number(after) * 1000 : Date.parse(after);
        if (Number.isFinite(at)) notBefore = Math.max(notBefore, at);
      }
    } catch {
      // まだつながらない。次の確認を待つ。
    } finally {
      window.clearTimeout(timeout);
      busy = false;
    }
    if (healthy) {
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ page, at: Date.now(), count: gate.count + 1 }));
      } catch {
        return; // 往復を防げないので開き直さない
      }
      say("つながりました。開き直しています…");
      reload();
      return;
    }
    schedule();
  }

  window.addEventListener("online", () => {
    attempt = 0;
    void probe();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void probe();
  });
  schedule();
})();
