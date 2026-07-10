import { describe, expect, test } from "bun:test";
import {
  STORAGE_ENV_VARS,
  StorageConfigError,
  assertStorageConfigured,
  missingStorageVariables,
  storageHealth,
} from "./storage-config";

// テスト用のダミー値。実際の秘密情報は使わない(自律実行ルール §5)。
const FULL_ENV: Record<string, string | undefined> = {
  S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
  S3_BUCKET: "dummy-bucket",
  S3_ACCESS_KEY_ID: "dummy-access-key-id",
  S3_SECRET_ACCESS_KEY: "dummy-secret-value",
};

describe("storageHealth", () => {
  test("all variables present → configured", () => {
    expect(storageHealth(FULL_ENV)).toEqual({
      storageConfigured: true,
      missingStorageVariables: [],
    });
  });

  test("missing S3_BUCKET → not configured, names S3_BUCKET", () => {
    const env = { ...FULL_ENV, S3_BUCKET: undefined };
    expect(storageHealth(env)).toEqual({
      storageConfigured: false,
      missingStorageVariables: ["S3_BUCKET"],
    });
  });

  test("empty string counts as missing (Railway leaves unset refs empty)", () => {
    const env = { ...FULL_ENV, S3_ENDPOINT: "" };
    expect(storageHealth(env).missingStorageVariables).toEqual(["S3_ENDPOINT"]);
  });

  test("multiple missing → names only, in ledger order", () => {
    const env = {
      ...FULL_ENV,
      S3_BUCKET: undefined,
      S3_SECRET_ACCESS_KEY: undefined,
    };
    expect(missingStorageVariables(env)).toEqual([
      "S3_BUCKET",
      "S3_SECRET_ACCESS_KEY",
    ]);
  });

  test("health payload never contains configured values", () => {
    const env = { ...FULL_ENV, S3_BUCKET: undefined };
    const json = JSON.stringify(storageHealth(env));
    for (const value of Object.values(FULL_ENV)) {
      if (value) expect(json).not.toContain(value);
    }
  });
});

describe("assertStorageConfigured", () => {
  test("passes silently when everything is set", () => {
    expect(() => assertStorageConfigured(FULL_ENV)).not.toThrow();
  });

  test("throws StorageConfigError carrying missing names only", () => {
    const env = { ...FULL_ENV, S3_ACCESS_KEY_ID: "" };
    let caught: unknown;
    try {
      assertStorageConfigured(env);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(StorageConfigError);
    const err = caught as StorageConfigError;
    expect(err.missing).toEqual(["S3_ACCESS_KEY_ID"]);
    expect(err.message).toContain("S3_ACCESS_KEY_ID");
    // メッセージにも値(秘密情報)を含めない
    for (const value of Object.values(FULL_ENV)) {
      if (value) expect(err.message).not.toContain(value);
    }
  });
});

describe("STORAGE_ENV_VARS ledger", () => {
  test("covers exactly the four storage variables", () => {
    expect([...STORAGE_ENV_VARS]).toEqual([
      "S3_ENDPOINT",
      "S3_BUCKET",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
    ]);
  });
});
