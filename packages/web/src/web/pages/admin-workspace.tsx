import type { ReactNode } from "react";

export function AdminWorkspace({
  name,
  children,
  actionBar,
}: {
  name: string;
  children: ReactNode;
  actionBar?: ReactNode;
}) {
  return (
    <section
      className="admin-screen-workspace"
      data-admin-workspace={name}
    >
      <div className="admin-screen-workspace__scroll">{children}</div>
      {actionBar}
    </section>
  );
}
