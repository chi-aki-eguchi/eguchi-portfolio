import type { ReactNode } from "react";

const WIDTH_CLASSES = {
  wide: "sm:max-w-[880px]",
  form: "sm:max-w-[560px]",
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
        className={`w-full px-4 py-6 sm:px-10 sm:py-8 ${WIDTH_CLASSES[width]}`}
      >
        {children}
      </div>
    </div>
  );
}
