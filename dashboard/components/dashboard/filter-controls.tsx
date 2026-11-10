"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Filter, GripVertical, Plus, X } from "lucide-react";
import { optionLabel } from "@/lib/data/run-filters";

export type FilterFacet = { key: string; label: string; options: string[] };

export function swapFilterKeys<T extends string>(
  keys: T[],
  source: string,
  target: string,
): T[] {
  const from = keys.indexOf(source as T);
  const to = keys.indexOf(target as T);
  if (from < 0 || to < 0 || from === to) return keys;
  const next = [...keys];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function useFilterReorder(
  keys: string[],
  onSwap: (source: string, target: string) => void,
) {
  const dragging = useRef<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const onDragStart = (event: DragEvent<HTMLButtonElement>, key: string) => {
    dragging.current = key;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", key);
  };
  const onDragOver = (event: DragEvent<HTMLElement>, key: string) => {
    if (!dragging.current || dragging.current === key) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropKey(key);
  };
  const onDragEnd = () => {
    dragging.current = null;
    setDropKey(null);
  };
  const onDrop = (event: DragEvent<HTMLElement>, key: string) => {
    if (!dragging.current) return;
    event.preventDefault();
    onSwap(dragging.current, key);
    onDragEnd();
  };
  const onDragKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    key: string,
  ) => {
    const direction =
      event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : 0;
    if (!direction) return;
    event.preventDefault();
    const target = keys[keys.indexOf(key) + direction];
    if (target) onSwap(key, target);
  };
  return { dropKey, onDragStart, onDragOver, onDrop, onDragEnd, onDragKeyDown };
}

export type FilterReorder = ReturnType<typeof useFilterReorder>;

export function isSelectedFilterValue(
  selected: string[] | undefined,
  values: string | string[],
): boolean {
  if (!selected?.length) return false;
  return (Array.isArray(values) ? values : [values]).some((value) =>
    selected.includes(value),
  );
}

export function FilterColumnHeader({
  filterKey,
  label,
  selected = [],
  formatOption = optionLabel,
  reorder,
  className = "",
}: {
  filterKey: string;
  label: string;
  selected?: string[];
  formatOption?: (option: string) => string;
  reorder?: FilterReorder;
  className?: string;
}) {
  const selectedLabels = selected.map(formatOption);
  return (
    <th
      scope="col"
      className={`${className} ${selected.length ? "filter-column-active" : ""} ${reorder?.dropKey === filterKey ? "filter-column-drop-target" : ""}`.trim()}
      onDragOver={
        reorder ? (event) => reorder.onDragOver(event, filterKey) : undefined
      }
      onDrop={reorder ? (event) => reorder.onDrop(event, filterKey) : undefined}
    >
      <span className="filter-column-heading">
        {reorder && (
          <button
            type="button"
            className="filter-drag-handle"
            aria-label={`Reorder ${label} column`}
            title="Drag to swap columns; use arrow keys to move"
            draggable
            onDragStart={(event) => reorder.onDragStart(event, filterKey)}
            onDragEnd={reorder.onDragEnd}
            onKeyDown={(event) => reorder.onDragKeyDown(event, filterKey)}
          >
            <GripVertical size={14} />
          </button>
        )}
        {label.toUpperCase()}
        {selectedLabels.length > 0 && (
          <span
            className="filter-column-selection"
            role="img"
            aria-label={`Filtered by ${label}: ${selectedLabels.join(", ")}`}
            title={`Filtered by ${label}: ${selectedLabels.join(", ")}`}
          />
        )}
      </span>
    </th>
  );
}

export function FilterToggle({
  open,
  count,
  boardId,
  onClick,
}: {
  open: boolean;
  count: number;
  boardId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`toolbar-button ${open ? "active" : ""}`}
      aria-pressed={open}
      aria-expanded={open}
      aria-controls={boardId}
      onClick={onClick}
    >
      <Filter /> Filter
      {count > 0 && <span className="filter-button-count">{count}</span>}
    </button>
  );
}

export function FilterBoard({
  id,
  label,
  facets,
  visibleKeys,
  selected,
  shownCount,
  totalCount,
  countLabel = "runs",
  pickerOpen,
  dropKey,
  onPickerToggle,
  onAdd,
  onClear,
  onReset,
  onRemove,
  onToggle,
  optionCount,
  formatOption = optionLabel,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onDragKeyDown,
}: {
  id: string;
  label: string;
  facets: FilterFacet[];
  visibleKeys: string[];
  selected: Record<string, string[]>;
  shownCount: number;
  totalCount: number;
  countLabel?: string;
  pickerOpen: boolean;
  dropKey?: string | null;
  onPickerToggle: () => void;
  onAdd: (key: string) => void;
  onClear: () => void;
  onReset: (key: string) => void;
  onRemove: (key: string) => void;
  onToggle: (key: string, option: string) => void;
  optionCount: (key: string, option: string) => number;
  formatOption?: (option: string) => string;
  onDragStart?: (event: DragEvent<HTMLButtonElement>, key: string) => void;
  onDragOver?: (event: DragEvent<HTMLElement>, key: string) => void;
  onDrop?: (event: DragEvent<HTMLElement>, key: string) => void;
  onDragEnd?: () => void;
  onDragKeyDown?: (
    event: KeyboardEvent<HTMLButtonElement>,
    key: string,
  ) => void;
}) {
  const shown = visibleKeys.flatMap((key) =>
    facets.filter((facet) => facet.key === key),
  );
  const activeCount = Object.values(selected).filter(
    (values) => values.length,
  ).length;
  const pickerId = `${id}-picker`;

  return (
    <section id={id} className="filter-board" aria-label={label}>
      <div className="filter-board-heading">
        <div>
          <Filter size={16} />
          <strong>Filters</strong>
          <span>{activeCount} active</span>
          <span className="filter-run-count">
            {shownCount} of {totalCount} {countLabel}
          </span>
        </div>
        <div className="filter-board-actions">
          <button
            type="button"
            className="filter-add-button"
            aria-expanded={pickerOpen}
            aria-controls={pickerId}
            onClick={onPickerToggle}
          >
            <Plus size={14} /> Filter
          </button>
          <button
            type="button"
            disabled={!visibleKeys.length}
            onClick={onClear}
          >
            Clear all
          </button>
        </div>
      </div>
      {pickerOpen && (
        <div
          className="filter-picker"
          id={pickerId}
          role="group"
          aria-label="Choose a filter"
        >
          {facets
            .filter((facet) => !visibleKeys.includes(facet.key))
            .map((facet) => (
              <button
                type="button"
                key={facet.key}
                onClick={() => onAdd(facet.key)}
              >
                <span>{facet.label}</span>
                <small>{facet.options.length} options</small>
              </button>
            ))}
          {visibleKeys.length === facets.length && (
            <span className="muted">All filters added</span>
          )}
        </div>
      )}
      <div className="filter-facets">
        {shown.map((facet) => {
          const chosen = selected[facet.key] ?? [];
          return (
            <section
              className={`filter-facet ${chosen.length ? "has-selection" : ""} ${dropKey === facet.key ? "drop-target" : ""}`}
              key={facet.key}
              onDragOver={
                onDragOver ? (event) => onDragOver(event, facet.key) : undefined
              }
              onDrop={onDrop ? (event) => onDrop(event, facet.key) : undefined}
            >
              <div className="filter-facet-heading">
                <div className="filter-facet-label">
                  {onDragStart && (
                    <button
                      type="button"
                      className="filter-drag-handle"
                      aria-label={`Reorder ${facet.label} filter`}
                      title="Drag to swap filters; use arrow keys to move"
                      draggable
                      onDragStart={(event) => onDragStart(event, facet.key)}
                      onDragEnd={onDragEnd}
                      onKeyDown={
                        onDragKeyDown
                          ? (event) => onDragKeyDown(event, facet.key)
                          : undefined
                      }
                    >
                      <GripVertical size={14} />
                    </button>
                  )}
                  <strong>{facet.label}</strong>
                </div>
                <div className="filter-facet-actions">
                  {chosen.length ? (
                    <button type="button" onClick={() => onReset(facet.key)}>
                      Reset
                    </button>
                  ) : (
                    <span>Any</span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${facet.label} filter`}
                    onClick={() => onRemove(facet.key)}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              <div className="filter-options">
                {facet.options.map((option) => {
                  const count = optionCount(facet.key, option);
                  if (!count && !chosen.includes(option)) return null;
                  return (
                    <label
                      className={`filter-option ${chosen.includes(option) ? "selected" : ""}`}
                      key={option}
                    >
                      <input
                        type="checkbox"
                        checked={chosen.includes(option)}
                        onChange={() => onToggle(facet.key, option)}
                      />
                      <span title={formatOption(option)}>
                        {formatOption(option)}
                      </span>
                      <small>{count}</small>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
        {!shown.length && !pickerOpen && (
          <div className="filter-empty">
            Choose <b>+ Filter</b> to show a filter and its options.
          </div>
        )}
      </div>
    </section>
  );
}
