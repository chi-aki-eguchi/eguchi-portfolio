import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Lock } from "lucide-react";

export default function AdminLoginPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // Focus the password field on mount. Done imperatively (not the autoFocus
  // attribute) since it's a dedicated full-page login — the focus is expected
  // and the declarative attribute is flagged by jsx-a11y for general use.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const login = useMutation({
    mutationFn: async (pw: string) => {
      const res = await api.admin.login.$post({ json: { password: pw } });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "パスワードが違います");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.setQueryData(["admin-me"], { authenticated: true });
      void qc.invalidateQueries({ queryKey: ["admin-me"] });
      navigate("/admin");
    },
    onError: (e: Error) => setError(e.message || "パスワードが違います"),
  });

  return (
    // The atelier's paper-and-ink front door. Deliberately NOT `.admin-atelier`
    // (smoke helpers use that class to detect the logged-in shell); shares the
    // same design tokens via `.admin-login` in styles.css instead, so it
    // follows light/dark like the public site it sits between.
    <div className="admin-login min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Lock
            size={24}
            strokeWidth={1.5}
            className="opacity-40"
            aria-hidden="true"
          />
        </div>
        <p className="text-center font-en text-[10px] tracking-[0.12em] uppercase opacity-50 mb-1">
          Portfolio Admin
        </p>
        <h1 className="admin-login__title text-center mb-10">Sign in</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate(password);
          }}
          className="flex flex-col gap-4"
        >
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="パスワード"
            aria-label="パスワード"
            autoComplete="current-password"
            className="admin-login__input w-full px-4 py-3 text-sm"
          />
          {error && (
            <p role="alert" className="admin-login__error text-xs">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={login.isPending}
            aria-busy={login.isPending || undefined}
            className="admin-login__submit text-xs tracking-[0.2em] uppercase py-3 disabled:opacity-50"
          >
            {login.isPending ? "..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
