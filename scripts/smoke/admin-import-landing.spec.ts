import { expect, test, type Page, type Route } from "@playwright/test";
import { gotoAdminTab, loginAsAdmin } from "./helpers";

type MockPhoto = {
  id: number;
  filename: string;
  url: string;
  title: string;
  meta: string;
  description: string;
  category: string;
  camera: null;
  lens: null;
  filmType: string;
  width: number;
  height: number;
  sortOrder: number;
  displaySize: "M";
  seriesId: null;
  isPublished: boolean;
  rotationDeg: number;
  focalX: number;
  focalY: number;
  createdAt: string;
  shotAt: null;
  thumbUrl: null;
  mediumUrl: null;
};

const addedIdsByFilename = new Map([
  ["added-1.jpg", 101],
  ["added-2.jpg", 102],
  ["added-3.jpg", 103],
]);

const additionalImportIdsByFilename = new Map([
  ["slow-a.jpg", 201],
  ["fast-b.jpg", 202],
  ["delayed-refresh.jpg", 301],
  ["failed-refresh.jpg", 302],
  ["existing-selection.jpg", 401],
]);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function mockPhoto(id: number, filename: string): MockPhoto {
  return {
    id,
    filename,
    url: "/og-image.jpg",
    title: filename,
    meta: "",
    description: "",
    category: "",
    camera: null,
    lens: null,
    filmType: "デジタル",
    width: 1200,
    height: 800,
    sortOrder: id,
    displaySize: "M",
    seriesId: null,
    isPublished: true,
    rotationDeg: 0,
    focalX: 50,
    focalY: 50,
    createdAt: "2026-07-27T00:00:00.000Z",
    shotAt: null,
    thumbUrl: null,
    mediumUrl: null,
  };
}

async function uploadedFilename(route: Route): Promise<string> {
  const body = route.request().postDataBuffer()?.toString("utf8") ?? "";
  const filenames = [
    ...addedIdsByFilename.keys(),
    ...additionalImportIdsByFilename.keys(),
    "failed.jpg",
    "duplicate.jpg",
    "all-failed.jpg",
  ];
  const filename = filenames.find((name) =>
    body.includes(`filename="${name}"`),
  );
  if (!filename) throw new Error("mock upload filename was not found");
  return filename;
}

async function fulfillSuccessfulUpload(route: Route, filename: string) {
  await route.fulfill({
    status: 201,
    contentType: "application/json",
    body: JSON.stringify({
      url: `/mock/${filename}`,
      width: 1200,
      height: 800,
      fileHash: `hash-${filename}`,
      thumbKey: null,
      mediumKey: null,
      shotAt: null,
      exifDateDigitized: null,
      exifCamera: null,
      exifLens: null,
      exifFocalLength: null,
      exifFNumber: null,
      exifExposureTime: null,
      exifIso: null,
    }),
  });
}

const photoTile = (page: Page, id: number) =>
  page.locator(`#admin-photo-${id}`);

test.describe("admin — 取り込み後に今回追加した写真へ着地", () => {
  test("成功だけを選択・表示し、失敗と重複を混ぜない", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "API差し替えを使う取り込み結果はdesktopで1回確認すれば十分",
    );

    let photos: MockPhoto[] = [mockPhoto(9, "already-exists.jpg")];
    const createdFilenames: string[] = [];

    // 一覧・アップロード・写真登録をすべてブラウザ内の固定応答へ差し替える。
    // 実DBや実ストレージには書き込まない。
    await page.route("**/api/photos?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ photos }),
      });
    });
    await page.route("**/api/admin/upload", async (route) => {
      const filename = await uploadedFilename(route);
      if (filename === "failed.jpg") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "mock upload failure" }),
        });
        return;
      }
      if (filename === "duplicate.jpg") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ duplicate: true, photoId: 9 }),
        });
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          url: `/mock/${filename}`,
          width: 1200,
          height: 800,
          fileHash: `hash-${filename}`,
          thumbKey: null,
          mediumKey: null,
          shotAt: null,
          exifDateDigitized: null,
          exifCamera: null,
          exifLens: null,
          exifFocalLength: null,
          exifFNumber: null,
          exifExposureTime: null,
          exifIso: null,
        }),
      });
    });
    await page.route("**/api/admin/photos", async (route) => {
      expect(route.request().method()).toBe("POST");
      const body = route.request().postDataJSON() as { filename: string };
      const id = addedIdsByFilename.get(body.filename);
      if (!id) throw new Error(`unexpected photo registration: ${body.filename}`);
      const photo = mockPhoto(id, body.filename);
      photos = [...photos, photo];
      createdFilenames.push(body.filename);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ photo }),
      });
    });

    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");

    await page
      .getByLabel(/画像ファイルを選択|Choose image files/)
      .setInputFiles([
        {
          name: "added-1.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.from("added-1"),
        },
        {
          name: "added-2.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.from("added-2"),
        },
        {
          name: "added-3.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.from("added-3"),
        },
        {
          name: "failed.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.from("failed"),
        },
        {
          name: "duplicate.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.from("duplicate"),
        },
      ]);

    const selectionToolbar = page.locator(
      "[data-library-selection-toolbar]",
    );
    await expect(selectionToolbar).toBeVisible();
    await expect(selectionToolbar).toHaveAttribute(
      "data-library-selected-count",
      "3",
    );
    await expect(selectionToolbar).toContainText(
      /今回追加した3枚を選択中|3 from this import selected/,
    );
    await expect(page.locator("[data-library-batch-actions]")).toBeVisible();

    await expect(
      page.locator("[data-library-recently-added-marker]"),
    ).toHaveCount(3);
    for (const id of addedIdsByFilename.values()) {
      await expect(photoTile(page, id)).toHaveAttribute(
        "data-library-recently-added",
        "true",
      );
    }
    await expect(
      photoTile(page, 101).locator("[data-library-photo-action]"),
    ).toHaveAttribute(
      "aria-label",
      /added-1\.jpg.*(?:今回追加|added in this import)/i,
    );
    await expect(photoTile(page, 9)).not.toHaveAttribute(
      "data-library-recently-added",
      "true",
    );
    await expect(page.getByText("failed.jpg", { exact: true })).toHaveCount(0);
    expect(createdFilenames.sort()).toEqual([
      "added-1.jpg",
      "added-2.jpg",
      "added-3.jpg",
    ]);

    const resultNotice = page
      .getByRole("alert")
      .filter({ hasText: /追加 3枚|3 added/ });
    await expect(resultNotice).toContainText(/失敗 1枚|1 failed/);

    // 選択は操作対象、目印は今回届いた写真の記憶なので別々に残る。
    for (const id of addedIdsByFilename.values()) {
      await photoTile(page, id).locator("[data-library-photo-action]").click();
    }
    await expect(selectionToolbar).toHaveAttribute(
      "data-library-selected-count",
      "0",
    );
    await expect(
      page.locator("[data-library-recently-added-marker]"),
    ).toHaveCount(3);

    // Galleryを離れて戻っても、親状態にある目印は消えない。
    await page
      .locator(".admin-sidebar__tab")
      .filter({ hasText: "Categories" })
      .click();
    await page.waitForTimeout(250);
    await page
      .locator(".admin-sidebar__tab")
      .filter({ hasText: "Library" })
      .click();
    await expect(page.locator("[data-library-grid-mode]")).toBeVisible();
    await expect(
      page.locator("[data-library-recently-added-marker]"),
    ).toHaveCount(3);

    await page.keyboard.press("Escape");
    await expect(
      page.locator("[data-library-recently-added-marker]"),
    ).toHaveCount(0);
  });

  test("F1: 取り込み中に開いた詳細欄の未保存編集を確認なしで閉じない", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "API差し替えを使う未保存保護はdesktopで1回確認すれば十分",
    );

    let photos: MockPhoto[] = [mockPhoto(9, "already-exists.jpg")];
    const uploadStarted = deferred();
    const finishUpload = deferred();

    await page.route("**/api/photos?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ photos }),
      });
    });
    await page.route("**/api/admin/upload", async (route) => {
      const filename = await uploadedFilename(route);
      expect(filename).toBe("added-1.jpg");
      uploadStarted.resolve();
      await finishUpload.promise;
      await fulfillSuccessfulUpload(route, filename);
    });
    await page.route("**/api/admin/photos", async (route) => {
      const body = route.request().postDataJSON() as { filename: string };
      const photo = mockPhoto(101, body.filename);
      photos = [...photos, photo];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ photo }),
      });
    });

    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    await page
      .getByLabel(/画像ファイルを選択|Choose image files/)
      .setInputFiles({
        name: "added-1.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("added-1"),
      });
    await uploadStarted.promise;

    await photoTile(page, 9).locator("[data-library-photo-action]").click();
    const inspector = page.locator("[data-library-inspector]");
    const titleInput = inspector.getByLabel(/^(タイトル|Title)$/);
    await titleInput.fill("未保存のタイトル");

    finishUpload.resolve();

    const confirm = page.getByRole("dialog").filter({
      hasText: /保存せずに閉じますか|Close it without saving/,
    });
    await expect(confirm).toBeVisible();
    await expect(inspector).toBeVisible();
    await expect(titleInput).toHaveValue("未保存のタイトル");
    await expect(page.locator("[data-library-mode]")).toHaveAttribute(
      "data-library-mode",
      "normal",
    );
  });

  test("F2: 重なった取り込みは最後に開始した分だけへ着地し、全完了まで進捗を残す", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "API差し替えを使う取り込み競合はdesktopで1回確認すれば十分",
    );

    let photos: MockPhoto[] = [mockPhoto(9, "already-exists.jpg")];
    const slowUploadStarted = deferred();
    const finishSlowUpload = deferred();

    await page.route("**/api/photos?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ photos }),
      });
    });
    await page.route("**/api/admin/upload", async (route) => {
      const filename = await uploadedFilename(route);
      if (filename === "slow-a.jpg") {
        slowUploadStarted.resolve();
        await finishSlowUpload.promise;
      }
      await fulfillSuccessfulUpload(route, filename);
    });
    await page.route("**/api/admin/photos", async (route) => {
      const body = route.request().postDataJSON() as { filename: string };
      const id = additionalImportIdsByFilename.get(body.filename);
      if (!id) throw new Error(`unexpected photo registration: ${body.filename}`);
      const photo = mockPhoto(id, body.filename);
      photos = [...photos, photo];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ photo }),
      });
    });

    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    const input = page.getByLabel(
      /画像ファイルを選択|Choose image files/,
    );
    await input.setInputFiles({
      name: "slow-a.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("slow-a"),
    });
    await slowUploadStarted.promise;
    await input.setInputFiles({
      name: "fast-b.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("fast-b"),
    });

    await expect(photoTile(page, 202)).toHaveAttribute(
      "data-library-recently-added",
      "true",
    );
    await expect(
      page.locator("[data-library-selection-toolbar]"),
    ).toHaveAttribute("data-library-selected-count", "1");
    await expect(page.getByText(/Importing \d+ \/ \d+/)).toBeVisible();

    finishSlowUpload.resolve();

    await expect(photoTile(page, 201)).toBeVisible();
    await expect(page.getByText(/Importing \d+ \/ \d+/)).toHaveCount(0);
    await expect(photoTile(page, 202)).toHaveAttribute(
      "data-library-recently-added",
      "true",
    );
    await expect(photoTile(page, 201)).not.toHaveAttribute(
      "data-library-recently-added",
      "true",
    );
    const selectionToolbar = page.locator(
      "[data-library-selection-toolbar]",
    );
    await expect(selectionToolbar).toHaveAttribute(
      "data-library-selected-count",
      "1",
    );
    await expect(selectionToolbar).toContainText(
      /今回追加した1枚を選択中|1 from this import selected/,
    );
  });

  test("F3: 一覧の再取得中は追加写真へ着地せず、完了後も絞り込み外と誤表示しない", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "API差し替えを使う再取得待ちはdesktopで1回確認すれば十分",
    );

    let photos: MockPhoto[] = [mockPhoto(9, "already-exists.jpg")];
    const refreshStarted = deferred();
    const finishRefresh = deferred();

    await page.route("**/api/photos?**", async (route) => {
      if (photos.some((photo) => photo.id === 301)) {
        refreshStarted.resolve();
        await finishRefresh.promise;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ photos }),
      });
    });
    await page.route("**/api/admin/upload", async (route) => {
      const filename = await uploadedFilename(route);
      expect(filename).toBe("delayed-refresh.jpg");
      await fulfillSuccessfulUpload(route, filename);
    });
    await page.route("**/api/admin/photos", async (route) => {
      const body = route.request().postDataJSON() as { filename: string };
      const photo = mockPhoto(301, body.filename);
      photos = [...photos, photo];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ photo }),
      });
    });

    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    await page
      .getByLabel(/画像ファイルを選択|Choose image files/)
      .setInputFiles({
        name: "delayed-refresh.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("delayed-refresh"),
      });
    await refreshStarted.promise;

    // 再取得が止まっている間に古い一覧へ選択を載せないことを確認する。
    await page.waitForTimeout(250);
    await expect(
      page.locator("[data-library-selection-toolbar]"),
    ).toHaveCount(0);
    await expect(
      page.getByText(/絞り込みの外|outside filters/),
    ).toHaveCount(0);
    await expect(
      page.locator("[data-library-recently-added-marker]"),
    ).toHaveCount(0);

    finishRefresh.resolve();

    const selectionToolbar = page.locator(
      "[data-library-selection-toolbar]",
    );
    await expect(selectionToolbar).toHaveAttribute(
      "data-library-selected-count",
      "1",
    );
    await expect(selectionToolbar).not.toContainText(
      /絞り込みの外|outside filters/,
    );
    await expect(photoTile(page, 301)).toHaveAttribute(
      "data-library-recently-added",
      "true",
    );
  });

  test("F3: 一覧の再取得に失敗した場合は誤った選択と目印を出さない", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "API差し替えを使う再取得失敗はdesktopで1回確認すれば十分",
    );

    let photos: MockPhoto[] = [mockPhoto(9, "already-exists.jpg")];

    await page.route("**/api/photos?**", async (route) => {
      if (photos.some((photo) => photo.id === 302)) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "mock refresh failure" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ photos }),
      });
    });
    await page.route("**/api/admin/upload", async (route) => {
      const filename = await uploadedFilename(route);
      expect(filename).toBe("failed-refresh.jpg");
      await fulfillSuccessfulUpload(route, filename);
    });
    await page.route("**/api/admin/photos", async (route) => {
      const body = route.request().postDataJSON() as { filename: string };
      const photo = mockPhoto(302, body.filename);
      photos = [...photos, photo];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ photo }),
      });
    });

    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    await page
      .getByLabel(/画像ファイルを選択|Choose image files/)
      .setInputFiles({
        name: "failed-refresh.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("failed-refresh"),
      });

    await expect(
      page.getByRole("alert").filter({
        hasText: /操作に失敗しました|The operation failed/,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator("[data-library-selection-toolbar]"),
    ).toHaveCount(0);
    await expect(
      page.locator("[data-library-recently-added-marker]"),
    ).toHaveCount(0);
    await expect(
      page.getByText(/絞り込みの外|outside filters/),
    ).toHaveCount(0);
  });

  test("重複だけの取り込みでは既存写真を今回追加として選ばない", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "API差し替えを使う重複だけの結果はdesktopで1回確認すれば十分",
    );

    const photos: MockPhoto[] = [mockPhoto(9, "already-exists.jpg")];
    let registrationCount = 0;

    await page.route("**/api/photos?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ photos }),
      });
    });
    await page.route("**/api/admin/upload", async (route) => {
      expect(await uploadedFilename(route)).toBe("duplicate.jpg");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ duplicate: true, photoId: 9 }),
      });
    });
    await page.route("**/api/admin/photos", async (route) => {
      registrationCount += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "registration must not run" }),
      });
    });

    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    await page
      .getByLabel(/画像ファイルを選択|Choose image files/)
      .setInputFiles({
        name: "duplicate.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("duplicate"),
      });

    await expect(
      page.getByRole("alert").filter({
        hasText: /重複スキップ|Duplicates skipped/,
      }),
    ).toBeVisible();
    expect(registrationCount).toBe(0);
    await expect(
      page.locator("[data-library-recently-added-marker]"),
    ).toHaveCount(0);
    await expect(
      page.locator("[data-library-selection-toolbar]"),
    ).toHaveCount(0);
  });

  test("全件失敗では今回追加の選択と目印を作らない", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "API差し替えを使う全件失敗はdesktopで1回確認すれば十分",
    );

    const photos: MockPhoto[] = [mockPhoto(9, "already-exists.jpg")];
    let registrationCount = 0;

    await page.route("**/api/photos?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ photos }),
      });
    });
    await page.route("**/api/admin/upload", async (route) => {
      expect(await uploadedFilename(route)).toBe("all-failed.jpg");
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "mock upload failure" }),
      });
    });
    await page.route("**/api/admin/photos", async (route) => {
      registrationCount += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "registration must not run" }),
      });
    });

    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    await page
      .getByLabel(/画像ファイルを選択|Choose image files/)
      .setInputFiles({
        name: "all-failed.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("all-failed"),
      });

    await expect(
      page.getByRole("alert").filter({ hasText: "all-failed.jpg" }),
    ).toBeVisible();
    expect(registrationCount).toBe(0);
    await expect(
      page.locator("[data-library-recently-added-marker]"),
    ).toHaveCount(0);
    await expect(
      page.locator("[data-library-selection-toolbar]"),
    ).toHaveCount(0);
  });

  test("既存選択があっても取り込み成功後は今回追加した写真だけを選ぶ", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "API差し替えを使う既存選択からの取り込みはdesktopで1回確認すれば十分",
    );

    let photos: MockPhoto[] = [
      mockPhoto(9, "already-exists.jpg"),
      mockPhoto(10, "also-exists.jpg"),
    ];

    await page.route("**/api/photos?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ photos }),
      });
    });
    await page.route("**/api/admin/upload", async (route) => {
      const filename = await uploadedFilename(route);
      expect(filename).toBe("existing-selection.jpg");
      await fulfillSuccessfulUpload(route, filename);
    });
    await page.route("**/api/admin/photos", async (route) => {
      const body = route.request().postDataJSON() as { filename: string };
      const photo = mockPhoto(401, body.filename);
      photos = [...photos, photo];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ photo }),
      });
    });

    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    await page.locator('[data-library-mode-action="select"]').click();
    await photoTile(page, 9).locator("[data-library-photo-action]").click();
    const selectionToolbar = page.locator(
      "[data-library-selection-toolbar]",
    );
    await expect(selectionToolbar).toHaveAttribute(
      "data-library-selected-count",
      "1",
    );

    const dataTransfer = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File(["existing-selection"], "existing-selection.jpg", {
          type: "image/jpeg",
        }),
      );
      return transfer;
    });
    const photoGrid = page.locator("[data-library-scroll]");
    await photoGrid.dispatchEvent("dragover", { dataTransfer });
    await photoGrid.dispatchEvent("drop", { dataTransfer });

    await expect(selectionToolbar).toHaveAttribute(
      "data-library-selected-count",
      "1",
    );
    await expect(selectionToolbar).toContainText(
      /今回追加した1枚を選択中|1 from this import selected/,
    );
    await expect(photoTile(page, 401)).toHaveAttribute(
      "data-library-recently-added",
      "true",
    );
    await expect(photoTile(page, 9)).not.toHaveAttribute(
      "data-library-recently-added",
      "true",
    );
  });

  test("詳細欄を閉じるEscでは目印を残し、次のEscで消す", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "API差し替えを使うEscの段階動作はdesktopで1回確認すれば十分",
    );

    let photos: MockPhoto[] = [mockPhoto(9, "already-exists.jpg")];

    // このテストも通信をすべて固定応答へ差し替え、実DBや実ストレージへ書き込まない。
    await page.route("**/api/photos?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ photos }),
      });
    });
    await page.route("**/api/admin/upload", async (route) => {
      const filename = await uploadedFilename(route);
      expect(filename).toBe("added-1.jpg");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          url: `/mock/${filename}`,
          width: 1200,
          height: 800,
          fileHash: `hash-${filename}`,
          thumbKey: null,
          mediumKey: null,
          shotAt: null,
          exifDateDigitized: null,
          exifCamera: null,
          exifLens: null,
          exifFocalLength: null,
          exifFNumber: null,
          exifExposureTime: null,
          exifIso: null,
        }),
      });
    });
    await page.route("**/api/admin/photos", async (route) => {
      expect(route.request().method()).toBe("POST");
      const body = route.request().postDataJSON() as { filename: string };
      expect(body.filename).toBe("added-1.jpg");
      const photo = mockPhoto(101, body.filename);
      photos = [...photos, photo];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ photo }),
      });
    });

    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");
    await page
      .getByLabel(/画像ファイルを選択|Choose image files/)
      .setInputFiles({
        name: "added-1.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("added-1"),
      });

    const marker = page.locator("[data-library-recently-added-marker]");
    await expect(marker).toHaveCount(1);

    // 取り込み直後の選択モードを抜けてから、追加写真の詳細欄を開く。
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-library-mode='normal']")).toBeVisible();
    await photoTile(page, 101).locator("[data-library-photo-action]").click();
    await expect(page.locator("[data-library-inspector]")).toBeVisible();

    // 1回目は詳細欄だけを閉じるため、今回追加の目印は残る。
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-library-inspector]")).toHaveCount(0);
    await expect(marker).toHaveCount(1);

    // 何も開いていない状態での次のEscが、目印だけを消す。
    await page.keyboard.press("Escape");
    await expect(marker).toHaveCount(0);
  });
});
