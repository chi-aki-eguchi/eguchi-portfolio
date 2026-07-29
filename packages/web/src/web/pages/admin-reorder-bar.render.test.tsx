import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminReorderBar } from "./admin-reorder-bar";

const labels = {
  region: "並べ替え操作",
  position: "2 / 10 番目",
  moveFirst: "先頭へ移動",
  movePrevious: "前へ移動",
  moveNext: "後へ移動",
  moveLast: "末尾へ移動",
  positionInput: "移動先の番号",
  moveAction: "移動する",
  undo: "元に戻す",
  chooseAgain: "選び直す",
  invalidPosition: "1〜10の番号を入力してください",
};

const noop = () => {};

test("対象がある時の下部帯に全操作・保存状態・読み上げ領域をまとめる", () => {
  const html = renderToStaticMarkup(
    <AdminReorderBar
      target={{
        id: 2,
        thumbnailSrc: "/thumb.jpg",
        title: "対象写真",
        position: 2,
        total: 10,
      }}
      busy={false}
      feedback={{ state: "saved", message: "保存済み" }}
      moveSummary="9番目から2番目へ移動しました"
      undoAvailable
      positionValue="2"
      positionInvalid={false}
      labels={labels}
      onMoveFirst={noop}
      onMovePrevious={noop}
      onMoveNext={noop}
      onMoveLast={noop}
      onPositionChange={noop}
      onMoveToPosition={noop}
      onUndo={noop}
      onChooseAgain={noop}
    />,
  );

  expect(html).toContain("data-library-reorder-target=\"2\"");
  expect(html).toContain("aria-live=\"polite\"");
  for (const label of [
    "先頭へ移動",
    "前へ移動",
    "後へ移動",
    "末尾へ移動",
    "移動する",
    "元に戻す",
    "選び直す",
  ]) {
    expect(html).toContain(label);
  }
});

test("端の対象は進めない側だけを無効にする", () => {
  const html = renderToStaticMarkup(
    <AdminReorderBar
      target={{
        id: 1,
        thumbnailSrc: "/thumb.jpg",
        title: "先頭写真",
        position: 1,
        total: 10,
      }}
      busy={false}
      feedback={null}
      moveSummary={null}
      undoAvailable={false}
      positionValue="1"
      positionInvalid={false}
      labels={labels}
      onMoveFirst={noop}
      onMovePrevious={noop}
      onMoveNext={noop}
      onMoveLast={noop}
      onPositionChange={noop}
      onMoveToPosition={noop}
      onUndo={noop}
      onChooseAgain={noop}
    />,
  );

  expect(html).toMatch(/disabled="" aria-label="先頭へ移動"/);
  expect(html).toMatch(/disabled="" aria-label="前へ移動"/);
  expect(html).not.toMatch(/disabled="" aria-label="後へ移動"/);
  expect(html).not.toMatch(/disabled="" aria-label="末尾へ移動"/);
});

test("Heroでも同じ下部帯を再利用し、対象解除と削除を分離する", () => {
  const html = renderToStaticMarkup(
    <AdminReorderBar
      scope="hero"
      target={{
        id: 7,
        thumbnailSrc: "/hero.jpg",
        title: "Hero対象",
        position: 3,
        total: 5,
      }}
      busy={false}
      feedback={{ state: "saving", message: "保存中" }}
      moveSummary={null}
      undoAvailable={false}
      positionValue="3"
      positionInvalid={false}
      labels={labels}
      onMoveFirst={noop}
      onMovePrevious={noop}
      onMoveNext={noop}
      onMoveLast={noop}
      onPositionChange={noop}
      onMoveToPosition={noop}
      onUndo={noop}
      onChooseAgain={noop}
      destructiveAction={{
        label: "ヒーローから削除",
        onAction: noop,
      }}
    />,
  );

  expect(html).toContain('data-admin-reorder-scope="hero"');
  expect(html).toContain('id="hero-reorder-position"');
  expect(html).toContain("選び直す");
  expect(html).toContain("ヒーローから削除");
});
