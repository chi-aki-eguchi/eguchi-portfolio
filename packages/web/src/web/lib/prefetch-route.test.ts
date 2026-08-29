import { describe, expect, test } from "bun:test";
import { prefetchRoute } from "./prefetch-route";

/**
 * 先読みは**効いているかどうかが画面に出ない**。配線が外れても、ページは
 * これまでどおり自分で取りに行くので誰も気づかない。気づけるのは「移動が
 * 前より遅い気がする」だけ。だから、どの経路が何を温めるかをここで留める。
 *
 * 実測（2026-08-30 / まっさらな入れ物で3回ずつ・1440px）:
 * TOP→Gallery で写真が6枚出るまで 中央値 2496ms → 1978ms。
 */
function fakeClient() {
  const asked: { key: unknown[]; staleTime?: number }[] = [];
  return {
    asked,
    client: {
      prefetchQuery: (opts: { queryKey: unknown[]; staleTime?: number }) => {
        asked.push({ key: opts.queryKey, staleTime: opts.staleTime });
        return Promise.resolve();
      },
    } as never,
  };
}

const keysFor = (path: string) => {
  const { asked, client } = fakeClient();
  prefetchRoute(client, path);
  return asked.map((a) => JSON.stringify(a.key));
};

describe("移動先の先読み", () => {
  test("ギャラリーは写真・シリーズ・分類を温める", () => {
    const k = keysFor("/gallery");
    expect(k).toContain('["photos"]');
    expect(k).toContain('["series"]');
    expect(k).toContain('["categories"]');
  });

  test("TOP はヒーローと写真とシリーズを温める", () => {
    const k = keysFor("/");
    expect(k).toContain('["hero-photos"]');
    expect(k).toContain('["photos"]');
    expect(k).toContain('["series"]');
  });

  test("シリーズ一覧は一覧だけ", () => {
    expect(keysFor("/series")).toEqual(['["series"]']);
  });

  test("シリーズ詳細はその1本ぶんも温める", () => {
    const k = keysFor("/series/ishigakiisland");
    expect(k).toContain('["series"]');
    expect(k).toContain('["series","ishigakiisland"]');
  });

  test("プロフィールと About（日英）は note の記事を温める", () => {
    for (const p of ["/profile", "/about", "/en/about"]) {
      expect(keysFor(p)).toEqual(['["note-posts"]']);
    }
  });

  test("知らない経路では何もしない（無駄な通信を出さない）", () => {
    expect(keysFor("/contact")).toEqual([]);
    expect(keysFor("/this-page-does-not-exist")).toEqual([]);
    expect(keysFor("/series/")).toEqual([]);
  });

  test("めったに変わらない分類は長めに新鮮扱いにする（着いた直後の再取得で写真がちらつかない）", () => {
    const { asked, client } = fakeClient();
    prefetchRoute(client, "/gallery");
    const cats = asked.find((a) => JSON.stringify(a.key) === '["categories"]');
    expect(cats?.staleTime).toBeGreaterThan(0);
  });
});
