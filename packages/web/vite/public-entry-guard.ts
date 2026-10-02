import type { Plugin } from "vite";

/**
 * 公開ページの入口（index.html）が最初に読む JS に、管理画面でしか使わない重い
 * 外部部品が入っていないかを、組み立てのたびに確かめる。
 *
 * 2026-10-02 まで外部部品をまとめて 1つの "vendor" に束ねていたため、PDF 作成
 * （pdf-lib・fontkit）と写真の取り込み（exifr）が入口に入り、公開ページを開く
 * 誰もが 292KB（brotli）余計に読んでいた。画面は普通に動くので気づけない。
 * 入口へ戻ってきたら、組み立てを止めて知らせる。
 */
const ADMIN_ONLY = /\/node_modules\/(pdf-lib|@pdf-lib\/[^/]+|exifr|harfbuzzjs)\//;

type Chunk = {
  type: "chunk";
  fileName: string;
  isEntry: boolean;
  facadeModuleId: string | null;
  imports: string[];
  moduleIds: string[];
};

export function publicEntryLeaks(bundle: Record<string, { type: string }>): string[] {
  const chunks = new Map<string, Chunk>();
  for (const item of Object.values(bundle))
    if (item.type === "chunk") chunks.set((item as Chunk).fileName, item as Chunk);
  const entry = [...chunks.values()].find(
    (c) => c.isEntry && c.facadeModuleId?.endsWith("index.html"),
  );
  if (!entry) return [];
  const seen = new Set<string>();
  const walk = (chunk: Chunk) => {
    if (seen.has(chunk.fileName)) return;
    seen.add(chunk.fileName);
    for (const name of chunk.imports) {
      const next = chunks.get(name);
      if (next) walk(next);
    }
  };
  walk(entry);
  const leaks = new Set<string>();
  for (const name of seen)
    for (const id of chunks.get(name)!.moduleIds) {
      const hit = id.match(ADMIN_ONLY);
      if (hit) leaks.add(hit[1]);
    }
  return [...leaks].sort();
}

export default function publicEntryGuard(): Plugin {
  return {
    name: "public-entry-guard",
    apply: "build",
    generateBundle(_options, bundle) {
      const leaks = publicEntryLeaks(bundle);
      if (leaks.length)
        this.error(
          `公開ページの入口の JS に、管理画面でしか使わない部品が入った: ${leaks.join(", ")}。` +
            "公開側のコードからの静的な import を外すか、vite.config.ts の manualChunks で束ねていないか確かめる。",
        );
    },
  };
}
