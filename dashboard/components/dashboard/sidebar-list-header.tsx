import type { ReactNode } from "react";

export default function SidebarListHeader({
  label,
  count,
  leading,
}: {
  label: string;
  count: number;
  leading?: ReactNode;
}) {
  return (
    <div className="run-list-header">
      {leading}
      <b>{label}</b>
      <span className="spacer" />
      <span className="count">{count} listed</span>
    </div>
  );
}
