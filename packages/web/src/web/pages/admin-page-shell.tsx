import type { ReactNode } from "react";

export function PageShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="h-full overflow-y-auto"
      data-admin-page-shell="form"
    >
      <div
        className="w-full px-4 py-8 md:max-w-none md:px-6 md:py-10 lg:max-w-[688px] xl:max-w-[800px] xl:px-10 xl:py-12"
      >
        {children}
      </div>
    </div>
  );
}
