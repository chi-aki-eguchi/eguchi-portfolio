import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// 保存が正しいかは実DBで `batch-photo-metadata.test.ts` が検査する。
// ここは「画面が1リクエストにまとめ、APIがその経路へ繋がっている」ことだけを見る。
const apiSource = readFileSync(import.meta.dir + "/index.ts", "utf8");
const adminSource = readFileSync(
  import.meta.dir + "/../web/pages/admin.tsx",
  "utf8",
);

describe("batch metadata edit wiring", () => {
  test("the dialog sends one request for all metadata fields", () => {
    const clientMutation = adminSource.slice(
      adminSource.indexOf("const batchMetaEdit = useMutation"),
      adminSource.indexOf("// O6: persist the smart-album list"),
    );
    expect(clientMutation).toContain('operation: "metadata"');
    expect(
      clientMutation.match(/adminApi\.photos\.batch\.\$post/g),
    ).toHaveLength(1);
  });

  test("the API validates then delegates the write to the tested module", () => {
    const metadataCase = apiSource.slice(
      apiSource.indexOf('case "metadata":'),
      apiSource.indexOf('case "camera":'),
    );
    expect(metadataCase).toContain("buildBatchPhotoMetadataPatch(value)");
    // 検査済みの書き込み経路をそのまま呼ぶ。ここで独自の UPDATE を組み立て直すと
    // 実DBの検査を素通りしてしまうため、`.update(` が現れないことも確かめる。
    expect(metadataCase).toMatch(
      /applyBatchPhotoMetadata\(\s*db,\s*schema\.photos,\s*cleanIds,\s*metadata,?\s*\)/,
    );
    expect(metadataCase).not.toContain(".update(");
  });
});
