"use client";

import { Search } from "lucide-react";
import type { TuningStudy } from "@/lib/data/tuning";
import SidebarHeading from "./sidebar-heading";
import SidebarListHeader from "./sidebar-list-header";

export default function TunerStudiesSidebar({
  studies,
  selectedStudyId,
  search,
  onSearchChange,
  onChooseStudy,
  onClose,
}: {
  studies: TuningStudy[];
  selectedStudyId: string;
  search: string;
  onSearchChange: (value: string) => void;
  onChooseStudy: (id: string) => void;
  onClose: () => void;
}) {
  const visibleStudies = studies.filter((item) =>
    item.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <aside className="runs-sidebar tuner-studies-sidebar" aria-label="Studies">
      <SidebarHeading
        title="Studies"
        count={studies.length}
        closeLabel="Close studies sidebar"
        onClose={onClose}
      />
      <div className="runs-controls">
        <label className="tuner-search tuner-study-search">
          <Search size={16} />
          <input
            aria-label="Search studies"
            placeholder="Search studies"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>
      <SidebarListHeader label="NAME" count={visibleStudies.length} />
      <div className="run-list tuner-study-options">
        {visibleStudies.map((item, index) => (
          <button
            key={item.id}
            className={`sidebar-option tuner-study-row ${item.id === selectedStudyId ? "active" : ""}`}
            aria-current={item.id === selectedStudyId ? "true" : undefined}
            onClick={() => onChooseStudy(item.id)}
          >
            <span
              className="run-dot"
              style={{
                background: ["#e83e59", "#5087e8", "#409a61", "#b27150"][
                  index % 4
                ],
              }}
            />
            <span>{item.name}</span>
            <small className="group-count">{item.runs.length}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}
