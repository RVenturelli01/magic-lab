import type { ReactNode } from "react";

/** Shared frame and pagination for the three selection lists. */
export default function SelectionTable({
  children,
  label,
  className = "",
  pagination,
}: {
  children: ReactNode;
  label: string;
  className?: string;
  pagination?: ReactNode;
}) {
  return (
    <div
      className={`selection-table ${className}`.trim()}
      role="region"
      aria-label={label}
    >
      <div className="selection-table-scroll">{children}</div>
      {pagination && (
        <div className="selection-table-pagination">{pagination}</div>
      )}
    </div>
  );
}
