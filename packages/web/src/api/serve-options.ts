/**
 * Bun.serve の idleTimeout（秒）。Bun の既定は10秒で、**答えを作っている途中でも**
 * 10秒何も送らないと接続を切る（2026-10-14 実測: 12秒かかる応答は10秒で切られ、受け手には
 * "socket connection was closed unexpectedly"）。前段の Railway はこれを 502 にする。
 * 写真の取り寄せ（最長15秒で打ち切り）・変換（最長30秒: api/index.ts
 * IMAGE_VARIANT_TIMEOUT_MS）が10秒を超えると、待っていた人に 502 が返っていた。
 * 自前の打ち切りより長くし、切るのは各処理の打ち切りに任せる。
 */
export const SERVER_IDLE_TIMEOUT_SECONDS = 75;
