import { useState, useEffect, useCallback } from "react";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "theme-preference";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  // 切り替えは1コマで全部そろえて替える（2026-10-05）。色を時間をかけて変える
  // 指定を持つ部品（上の帯は背景色 0.3 秒）だけが、ほかより遅れて替わっていた。
  // そのうえ Chromium では、その変化の終わりに帯が1コマだけ元の色へ戻る
  //（スマホでメニューを開いたまま暗い表示へ: 帯だけ1コマ白。本番で6回中2回）。
  // 替える瞬間だけ「時間をかけて変える」を止め、2コマ後に戻す。
  const changing = (root.dataset.theme ?? "light") !== resolved;
  if (changing && typeof requestAnimationFrame === "function") {
    root.dataset.themeSwitching = "";
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        delete root.dataset.themeSwitching;
      }),
    );
  }
  root.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && !meta.getAttribute("data-custom")) {
    meta.setAttribute("content", resolved === "dark" ? "#121212" : "#f7f7f7");
  }
}

export function useDarkMode() {
  const [preference, setPreference] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
  });

  const resolved = preference === "system" ? getSystemTheme() : preference;

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(getSystemTheme());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const toggle = useCallback(() => {
    setPreference((prev) => {
      const next = (prev === "system" ? getSystemTheme() : prev) === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const setTheme = useCallback((t: Theme) => {
    if (t === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, t);
    setPreference(t);
  }, []);

  return { theme: preference, resolved, toggle, setTheme } as const;
}
