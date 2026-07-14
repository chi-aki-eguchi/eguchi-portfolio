import { describe, expect, test } from "bun:test";
import {
  createSettingsImageCleanupRunner,
  invalidImageSettingKeys,
  staleSettingsImageKeys,
  unreferencedImageKeys,
} from "./settings-image-cleanup";
import { createSerialQueue } from "./serial-queue";

describe("staleSettingsImageKeys", () => {
  test("差し替えられた profilePhotoUrl の旧キーを返す", () => {
    const keys = staleSettingsImageKeys(
      [["profilePhotoUrl", "/api/images/profile/2-new.jpg"]],
      new Map([["profilePhotoUrl", "/api/images/profile/1-old.jpg"]]),
    );
    expect(keys).toEqual(["profile/1-old.jpg"]);
  });

  test("値が変わっていなければ何も返さない", () => {
    const keys = staleSettingsImageKeys(
      [["profilePhotoUrl", "/api/images/profile/1-same.jpg"]],
      new Map([["profilePhotoUrl", "/api/images/profile/1-same.jpg"]]),
    );
    expect(keys).toEqual([]);
  });

  test("初回保存(旧値なし)では何も返さない", () => {
    const keys = staleSettingsImageKeys(
      [["profilePhotoUrl", "/api/images/profile/1-first.jpg"]],
      new Map(),
    );
    expect(keys).toEqual([]);
  });

  test("photos/ 等、専用prefix外を指す旧値は絶対に返さない", () => {
    const keys = staleSettingsImageKeys(
      [["profilePhotoUrl", "/api/images/profile/2-new.jpg"]],
      new Map([["profilePhotoUrl", "/api/images/photos/gallery-shot.jpg"]]),
    );
    expect(keys).toEqual([]);
  });

  test("プロキシパス形式でない旧値(絶対URL等)は返さない", () => {
    const keys = staleSettingsImageKeys(
      [["profilePhotoUrl", "/api/images/profile/2-new.jpg"]],
      new Map([
        ["profilePhotoUrl", "https://evil.example/api/images/profile/x.jpg"],
      ]),
    );
    expect(keys).toEqual([]);
  });

  test("heroPhotoUrl は hero/ prefix のみ削除候補になる", () => {
    const keys = staleSettingsImageKeys(
      [["heroPhotoUrl", "/api/images/hero/2-new.jpg"]],
      new Map([["heroPhotoUrl", "/api/images/hero/1-old.jpg"]]),
    );
    expect(keys).toEqual(["hero/1-old.jpg"]);

    const crossPrefix = staleSettingsImageKeys(
      [["heroPhotoUrl", "/api/images/hero/2-new.jpg"]],
      new Map([["heroPhotoUrl", "/api/images/profile/1-old.jpg"]]),
    );
    expect(crossPrefix).toEqual([]);
  });

  test("もう片方の設定が同じオブジェクトを参照し続ける場合は消さない", () => {
    const keys = staleSettingsImageKeys(
      [["profilePhotoUrl", "/api/images/profile/2-new.jpg"]],
      new Map([
        ["profilePhotoUrl", "/api/images/profile/1-shared.jpg"],
        ["heroPhotoUrl", "/api/images/profile/1-shared.jpg"],
      ]),
    );
    expect(keys).toEqual([]);
  });

  test("対象外の設定キーは無視する", () => {
    const keys = staleSettingsImageKeys(
      [["siteName", "Aki Eguchi"]],
      new Map([["profilePhotoUrl", "/api/images/profile/1-old.jpg"]]),
    );
    expect(keys).toEqual([]);
  });

  test("再確認で参照が消えたままの候補だけが残る", () => {
    const keys = unreferencedImageKeys(
      ["profile/1-old.jpg", "hero/1-old.jpg"],
      new Map([
        ["profilePhotoUrl", "/api/images/profile/2-new.jpg"],
        ["heroPhotoUrl", "/api/images/hero/1-old.jpg"],
      ]),
    );
    expect(keys).toEqual(["profile/1-old.jpg"]);
  });

  test("両方のキーが同時に差し替わればそれぞれの旧キーを返す", () => {
    const keys = staleSettingsImageKeys(
      [
        ["profilePhotoUrl", "/api/images/profile/2-new.jpg"],
        ["heroPhotoUrl", "/api/images/hero/2-new.jpg"],
      ],
      new Map([
        ["profilePhotoUrl", "/api/images/profile/1-old.jpg"],
        ["heroPhotoUrl", "/api/images/hero/1-old.jpg"],
      ]),
    );
    expect(keys.sort()).toEqual(["hero/1-old.jpg", "profile/1-old.jpg"]);
  });
});

describe("invalidImageSettingKeys", () => {
  test("専用prefixのプロキシURLと空文字(解除)は許可される", () => {
    expect(
      invalidImageSettingKeys([
        ["profilePhotoUrl", "/api/images/profile/1.jpg"],
        ["heroPhotoUrl", "/api/images/hero/1.jpg"],
        ["profilePhotoUrl", ""],
        ["siteName", "Aki Eguchi"],
      ]),
    ).toEqual([]);
  });

  test("別キーの旧値を書き戻す入れ替え(2026-07-14 P1再指摘)は拒否される", () => {
    // 初期 profile=P1 / hero=H1 で A(profile=H1)・B(hero=P1) の両保存とも
    // 400 になるため、削除済みオブジェクトを最終参照に残す入れ替えは
    // API境界で成立しない。
    expect(
      invalidImageSettingKeys([
        ["profilePhotoUrl", "/api/images/hero/H1.jpg"],
      ]),
    ).toEqual(["profilePhotoUrl"]);
    expect(
      invalidImageSettingKeys([["heroPhotoUrl", "/api/images/profile/P1.jpg"]]),
    ).toEqual(["heroPhotoUrl"]);
  });

  test("プロキシパスでない値(絶対URL・photos/等)は拒否される", () => {
    expect(
      invalidImageSettingKeys([
        ["profilePhotoUrl", "https://example.com/x.jpg"],
        ["heroPhotoUrl", "/api/images/photos/gallery.jpg"],
      ]),
    ).toEqual(["profilePhotoUrl", "heroPhotoUrl"]);
  });

  test("対象外キーは値の形式を問わず拒否されない", () => {
    expect(invalidImageSettingKeys([["siteName", "何でもよい"]])).toEqual([]);
  });
});

describe("createSettingsImageCleanupRunner (キュー実行順の統合テスト)", () => {
  const proxy = (key: string) => `/api/images/${key}`;

  function makeFakeStore(initial: Record<string, string>) {
    const dbMap = new Map(Object.entries(initial));
    const deleted: string[] = [];
    return {
      dbMap,
      deleted,
      deps: {
        queue: createSerialQueue(),
        readManagedValues: async () => new Map(dbMap),
        write: async (entries: ReadonlyArray<[string, string]>) => {
          for (const [k, v] of entries) dbMap.set(k, v);
        },
        deleteObject: async (key: string) => {
          deleted.push(key);
        },
      },
    };
  }

  test("同時投入の書き戻し(A: P1→P2, B: P2→P1): 最終参照P1はpending参照で守られる", async () => {
    const store = makeFakeStore({ profilePhotoUrl: proxy("profile/P1.jpg") });
    const run = createSettingsImageCleanupRunner(store.deps);
    // 両方を同期的に投入してから待つ — 実装と同じ createSerialQueue が
    // A完了→B開始の順で流す(2026-07-14 codex-reviewer再レビューの再現手順)。
    const a = run([["profilePhotoUrl", proxy("profile/P2.jpg")]]);
    const b = run([["profilePhotoUrl", proxy("profile/P1.jpg")]]);
    await Promise.all([a, b]);
    // Aの削除フェーズ時点でBがP1を書く予定のため、P1は削除されない。
    // Bの削除フェーズではP2が正しく未参照となり削除される。
    expect(store.dbMap.get("profilePhotoUrl")).toBe(proxy("profile/P1.jpg"));
    expect(store.deleted).toEqual(["profile/P2.jpg"]);
  });

  test("順次の通常差し替え(P1→P2→P3): 旧キーだけが順に削除される", async () => {
    const store = makeFakeStore({ profilePhotoUrl: proxy("profile/P1.jpg") });
    const run = createSettingsImageCleanupRunner(store.deps);
    await Promise.all([
      run([["profilePhotoUrl", proxy("profile/P2.jpg")]]),
      run([["profilePhotoUrl", proxy("profile/P3.jpg")]]),
    ]);
    expect(store.dbMap.get("profilePhotoUrl")).toBe(proxy("profile/P3.jpg"));
    expect(store.deleted).toEqual(["profile/P1.jpg", "profile/P2.jpg"]);
  });

  test("書き込み失敗時は削除されず、pending登録も解放される", async () => {
    const store = makeFakeStore({ profilePhotoUrl: proxy("profile/P1.jpg") });
    let failNext = true;
    const run = createSettingsImageCleanupRunner({
      ...store.deps,
      write: async (entries) => {
        if (failNext) {
          failNext = false;
          throw new Error("write failed");
        }
        for (const [k, v] of entries) store.dbMap.set(k, v);
      },
    });
    await expect(
      run([["profilePhotoUrl", proxy("profile/P2.jpg")]]),
    ).rejects.toThrow("write failed");
    expect(store.deleted).toEqual([]);
    expect(store.dbMap.get("profilePhotoUrl")).toBe(proxy("profile/P1.jpg"));
    // 失敗したAのpending(P2)が残留していないこと — 後続のP1→P3差し替えで
    // P1が通常どおり削除される。
    await run([["profilePhotoUrl", proxy("profile/P3.jpg")]]);
    expect(store.dbMap.get("profilePhotoUrl")).toBe(proxy("profile/P3.jpg"));
    expect(store.deleted).toEqual(["profile/P1.jpg"]);
  });

  test("R2削除の失敗は握りつぶされ、保存自体は成功する", async () => {
    const store = makeFakeStore({ profilePhotoUrl: proxy("profile/P1.jpg") });
    const run = createSettingsImageCleanupRunner({
      ...store.deps,
      deleteObject: async () => {
        throw new Error("R2 down");
      },
    });
    await expect(
      run([["profilePhotoUrl", proxy("profile/P2.jpg")]]),
    ).resolves.toBeUndefined();
    expect(store.dbMap.get("profilePhotoUrl")).toBe(proxy("profile/P2.jpg"));
  });
});
