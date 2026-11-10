import { ChevronsLeft, ChevronsRight } from "lucide-react";
import IconButton from "./icon-button";

export default function SidebarHeading({
  title,
  count,
  id,
  closeLabel,
  onClose,
}: {
  title: string;
  count: number;
  id?: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="runs-heading">
      <h2 id={id}>
        {title} <span className="count">{count}</span>
      </h2>
      <div className="spacer" />
      <IconButton label={closeLabel} onClick={onClose}>
        <ChevronsLeft />
      </IconButton>
    </div>
  );
}

export function CollapsedSidebar({
  label,
  onOpen,
}: {
  label: string;
  onOpen: () => void;
}) {
  return (
    <aside className="collapsed-sidebar" aria-label={label}>
      <div className="runs-heading">
        <IconButton label={label} onClick={onOpen}>
          <ChevronsRight />
        </IconButton>
      </div>
    </aside>
  );
}
