import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

type FocalColumns = {
  rotationDeg: SQLWrapper;
  focalX: SQLWrapper;
  focalY: SQLWrapper;
};

export type FocalRotationUpdate = {
  focalX: SQL<number | null>;
  focalY: SQL<number | null>;
};

// 焦点が両方とも未設定なら「中央」の意味なので、回しても中央のまま。NULL を
// 保ち、触っていない写真に勝手な数値を書き込まない。片方だけ設定されている
// 場合は、欠けているほうを中央(50)として扱う。
function focalParts(columns: FocalColumns) {
  return {
    bothUnset: sql`${columns.focalX} IS NULL AND ${columns.focalY} IS NULL`,
    x: sql`COALESCE(${columns.focalX}, 50)`,
    y: sql`COALESCE(${columns.focalY}, 50)`,
  };
}

/**
 * 相対回転（左右90度）に合わせて焦点も回す。写真ごとに現在値から計算するので、
 * 一括操作でも1回の UPDATE のまま原子性を保てる。
 *
 * 変換は `rotateFocalPoint()`（`shared/image-url.ts`）と同じ。
 * 時計回り90度: (x, y) → (100 - y, x)。
 */
export function buildFocalRotationByDelta(
  columns: FocalColumns,
  delta: 90 | 180 | 270,
): FocalRotationUpdate {
  const { bothUnset, x, y } = focalParts(columns);
  const [nextX, nextY] =
    delta === 90
      ? [sql`100 - ${y}`, x]
      : delta === 180
        ? [sql`100 - ${x}`, sql`100 - ${y}`]
        : [y, sql`100 - ${x}`];
  return {
    focalX: sql<number | null>`CASE WHEN ${bothUnset} THEN NULL ELSE ${nextX} END`,
    focalY: sql<number | null>`CASE WHEN ${bothUnset} THEN NULL ELSE ${nextY} END`,
  };
}

/**
 * 角度を絶対値で指定する保存（写真1枚の編集）に合わせて焦点を回す。
 * 回転量は写真ごとに `rotationDeg` との差から出すので、事前の読み取りが要らない。
 */
export function buildFocalRotationToAngle(
  columns: FocalColumns,
  target: 0 | 90 | 180 | 270,
): FocalRotationUpdate {
  const { bothUnset, x, y } = focalParts(columns);
  const delta = sql`((${target} - ${columns.rotationDeg}) % 360 + 360) % 360`;
  return {
    focalX: sql<number | null>`CASE
      WHEN ${bothUnset} THEN NULL
      WHEN ${delta} = 90 THEN 100 - ${y}
      WHEN ${delta} = 180 THEN 100 - ${x}
      WHEN ${delta} = 270 THEN ${y}
      ELSE ${x} END`,
    focalY: sql<number | null>`CASE
      WHEN ${bothUnset} THEN NULL
      WHEN ${delta} = 90 THEN ${x}
      WHEN ${delta} = 180 THEN 100 - ${y}
      WHEN ${delta} = 270 THEN 100 - ${x}
      ELSE ${y} END`,
  };
}
