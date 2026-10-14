# Offline recovery and HERO gesture interruption — 2026-10-14

## Changes

- `packages/web/public/sw.js`: retry a failed page GET once (250 ms delay), including transient 502/503/504 responses; honor Retry-After and aborted navigations. Cache failures no longer block usable image/script responses. Background refresh/write failures are caught and tied to worker lifetime. Missing offline cache still yields a real no-store 503 response. Do not cache page HTML or ordinary API responses; never retry writes. Keep the 300-image limit and do not claim a first visit mid-preload.
- `packages/web/public/offline.html`: distinguish a connection/server problem from a definite loss of internet; retry the current URL, with one recovery attempt on an online event and no polling.
- `packages/web/src/web/components/develop/DevelopIntro.tsx`: separate immediate gesture interruption from the animated ending. Previously entering `out` also set `grown=true`, starting a full-screen photo expansion during a swipe. Input now cancels timers and completes once immediately; uninterrupted playback keeps its existing animation.

No photo, saved setting, database, environment variable, resource limit or Railway configuration is changed. The general parallax effect and carousel implementation are unchanged.

## Verification

After installing the repository dependencies, run:

```sh
node --test scripts/regression/site-resilience.test.mjs scripts/regression/hero-interruption.test.mjs scripts/regression/offline-page.test.mjs
```

Node 22.16.0: **47 passed, 0 failed**. The HERO test transpiles the actual TSX effect with TypeScript and uses mocked hooks and a deterministic clock; it is not a real React/browser performance test. Four selected worker regressions and five input-phase regressions fail against the original files; uninterrupted playback passes on both versions. Original source blob hashes were verified before modification.

Not performed in this environment: full Bun build/typecheck/lint, integrated smoke tests, real iPhone/Safari frame-rate testing, or live production verification. Follow the repository's normal checks before merging/deployment. After deployment, verify `/api/health`, the build identity, first/repeat visits, interruption at each intro phase, and vertical/horizontal gestures on a real device. Do not clear all browser data as the primary fix.

## Railway observations (read-only)

At inspection on 2026-10-14, production was online (one running replica), with no crashed deployment in the 7-day overview. Domain verification and TLS certificate were valid. This does **not** prove there were no request failures: the 7-day HTTP aggregate contained 68 5xx responses out of 151,385 requests. Logs on 2026-10-10 around 12:13 JST show image requests returning 502 after repeated upstream `connection closed unexpectedly` errors, lasting roughly 35–36 seconds. These sampled requests used a headless-browser user agent and do not establish that they were the user's reported visit. The root cause of those upstream closures is unconfirmed.

The reported deploy configuration has no explicit HTTP healthcheck. Consider `/api/health` as a readiness check after confirming the current endpoint and startup behavior; no speculative infrastructure change was applied here. The client recovery changes cannot repair a sustained server/network outage.
