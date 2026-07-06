const SERVICE_HOST = "akieguchi.com";

export function isServiceHost(hostname?: string): boolean {
  const raw =
    hostname ??
    (typeof window === "undefined" ? "" : window.location.hostname);
  const host = raw.replace(/^www\./, "").toLowerCase();
  return host === SERVICE_HOST || host === "localhost" || host === "127.0.0.1";
}
