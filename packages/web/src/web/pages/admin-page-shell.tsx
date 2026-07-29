import type { ReactNode } from "react";

const WIDTH_CLASSES = {
  wide: "sm:max-w-[880px]",
  form: "md:max-w-none lg:max-w-[688px] xl:max-w-[800px]",
} as const;

export function PageShell({
  width,
  children,
}: {
  width: keyof typeof WIDTH_CLASSES;
  children: ReactNode;
}) {
  return (
    <div
      className="h-full overflow-y-auto"
      data-admin-page-shell={width}
    >
      <div
        className={`w-full px-4 py-8 md:px-6 md:py-10 xl:px-10 xl:py-12 ${WIDTH_CLASSES[width]}`}
      >
        {children}
      </div>
    </div>
  );
}
