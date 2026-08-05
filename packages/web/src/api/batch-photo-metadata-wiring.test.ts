import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const apiSource = readFileSync(import.meta.dir + "/index.ts", "utf8");
const adminSource = readFileSync(import.meta.dir + "/../web/pages/admin.tsx", "utf8");

describe("batch metadata edit wiring", () => {
  test("updates all selected metadata fields in one API request and one DB write", () => {
    const clientMutation = adminSource.slice(
      adminSource.indexOf("const batchMetaEdit = useMutation"),
      adminSource.indexOf("// O6: persist the smart-album list"),
    );
    expect(clientMutation).toContain('operation: "metadata"');
    expect(clientMutation.match(/adminApi\.photos\.batch\.\$post/g)).toHaveLength(1);

    const metadataCase = apiSource.slice(
      apiSource.indexOf('case "metadata":'),
      apiSource.indexOf('case "camera":'),
    );
    expect(metadataCase).toContain("buildBatchPhotoMetadataPatch(value)");
    expect(metadataCase.match(/\.update\(schema\.photos\)/g)).toHaveLength(1);
  });
});
