// 写真中心の骨格は 2026-09-30 に止めた（packages/web/src/web/lib/site-design-flag.ts）。
// 止めている間は、写真中心だけを確かめる spec と、写真中心の組み合わせを飛ばす。
export { BOOK_DESIGN_ENABLED } from "../../packages/web/src/web/lib/site-design-flag.ts";

/** 確かめる骨格。止めている写真中心は含めない。 */
import { BOOK_DESIGN_ENABLED as ENABLED } from "../../packages/web/src/web/lib/site-design-flag.ts";
export const SITE_DESIGNS = (ENABLED ? ["book", "classic"] : ["classic"]) as readonly ("book" | "classic")[];
