import type { ReactNode } from "react";
import { Page, type PageWidth } from "./admin-ui";

// 入力が主役の画面の枠。実体は admin-ui.tsx の Page。
// 呼び出し側が多いので名前は残し、寸法の決定は1箇所(Page)へ寄せている。
export function PageShell({
  width = "form",
  children,
}: {
  width?: PageWidth;
  children: ReactNode;
}) {
  return <Page width={width}>{children}</Page>;
}
