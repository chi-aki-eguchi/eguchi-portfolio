export const num = (v: string | undefined, def: number): number => {
  const n = parseFloat(v ?? "");
  return isNaN(n) ? def : n;
};

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

const SAFE_HREF_RE = /^(https?:|mailto:)/i;
export function safeHref(url: string): string {
  return SAFE_HREF_RE.test(url) ? url : "#";
}
