// site_settings の書き込みごとに増える世代カウンタ。server.ts のOGP用
// settingsキャッシュ(60s TTL)がこれを見て即失効する — 差し替えで旧R2オブジェクトを
// 削除した後も最大60秒、削除済みURLをHTMLに注入し続ける穴を塞ぐ
// (2026-07-14 codex-reviewer P2指摘)。プロセス内カウンタで足りるのは、
// APIとHTML配信が同一Bunプロセスで動いているため。
let version = 0;

export function bumpSettingsVersion(): void {
  version += 1;
}

export function settingsVersion(): number {
  return version;
}
