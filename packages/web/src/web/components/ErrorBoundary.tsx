import { Component, type ReactNode } from "react";

const RELOAD_KEY = "cl_reload_ts";
const RELOAD_COOLDOWN_MS = 10_000;

// A failed dynamic import (stale chunk right after a deploy, or a network blip)
// throws during render. Detect it so we can recover by reloading the current build.
function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /Loading chunk|dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically/i.test(msg);
}

interface State { hasError: boolean }

/**
 * Top-level safety net. Without it, any render error or lazy-chunk load failure
 * white-screens the whole SPA with no way out. Chunk errors auto-reload once
 * (cooldown-guarded against loops); anything else shows a quiet retry screen.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error)) {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      // Reload at most once per cooldown so a genuinely-missing chunk can't loop.
      if (Date.now() - last > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-en)", fontSize: 14, color: "rgba(var(--foreground-rgb,26,26,26),0.55)" }}>
          問題が発生しました。
        </p>
        <button
          onClick={() => { sessionStorage.removeItem(RELOAD_KEY); window.location.reload(); }}
          style={{ fontFamily: "var(--font-en)", fontSize: 12, letterSpacing: "0.08em", border: "1px solid rgba(var(--foreground-rgb,26,26,26),0.25)", padding: "8px 20px", borderRadius: 4, background: "transparent", cursor: "pointer", color: "var(--foreground, #1a1a1a)" }}
        >
          再読み込み
        </button>
      </div>
    );
  }
}
