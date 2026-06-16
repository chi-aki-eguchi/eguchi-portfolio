import { hc } from "hono/client";
import type { AppType } from "../../api";

const client = hc<AppType>("/");
export const api = client.api;

// The admin subtree of AppType exceeds TypeScript's type-instantiation limits:
// only the first few admin routes survive in the inferred client type, so
// `api.admin.photos` etc. fail to typecheck even though they work at runtime
// (pre-existing; surfaced when the broken `tsc --noEmit` gate was fixed).
// adminApi is the same object with loosened typing — admin.tsx annotates its
// query results locally instead. The public `api.*` keeps full inference.
// TODO: split admin routes into a sub-app mounted via .route() to restore types.
// oxlint-disable-next-line no-explicit-any
export const adminApi = (client.api as { admin: any }).admin;
