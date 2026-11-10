import type { ReactNode } from "react";

export default function ViewHeader({
  title,
  badge,
  actions,
  className = "",
}: {
  title: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`view-intro ${className}`.trim()}>
      <div className="view-intro-copy">
        <h2>
          {title}
          {badge}
        </h2>
      </div>
      {actions && <div className="view-intro-actions">{actions}</div>}
    </header>
  );
}
