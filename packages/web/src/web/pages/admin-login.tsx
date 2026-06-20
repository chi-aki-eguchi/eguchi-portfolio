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
  useEffect(() => { inputRef.current?.focus(); }, []);

  const login = useMutation({
    mutationFn: async (pw: string) => {
      const res = await api.admin.login.$post({ json: { password: pw } });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
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
    <div className="min-h-screen bg-[#111] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Lock size={28} className="text-[#c8a96e]" />
        </div>
        <h1 className="text-center text-xs tracking-[0.3em] uppercase text-[#555] mb-8">Admin Login</h1>

        <form
          onSubmit={(e) => { e.preventDefault(); login.mutate(password); }}
          className="flex flex-col gap-4"
        >
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="パスワード"
            aria-label="パスワード"
            autoComplete="current-password"
            className="bg-[#1c1c1c] border border-white/10 text-[#e8e8e8] px-4 py-3 text-sm outline-none focus:border-[#c8a96e] transition-colors placeholder:text-[#444] w-full"
          />
          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={login.isPending}
            className="border border-[#c8a96e] text-[#c8a96e] text-xs tracking-[0.2em] uppercase py-3 hover:bg-[#c8a96e] hover:text-[#111] transition-colors disabled:opacity-50"
          >
            {login.isPending ? "..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
