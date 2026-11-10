"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  GripVertical,
  Maximize2,
  Minimize2,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import type { Project, Run } from "@/lib/data";
import {
  buildTable,
  defaultPanel,
  fieldLabel,
  isPanel,
  tableFields,
  type TablePanel,
} from "@/lib/data/table-model";
import { exportTable } from "@/lib/table-export";
import {
  restorePanelLayout,
  resizedPanelLayout,
  type PanelLayout,
} from "@/lib/data/panel-layout";
import ViewHeader from "./view-header";

const STORAGE_KEY = "local-tables-v1";
const DEFAULT_TABLE_LAYOUT: PanelLayout = { span: 6, height: 430 };

export default function ScalarTables({
  runs,
  project,
  onOpenRun,
}: {
  runs: Run[];
  project: Project | null;
  onOpenRun: (run: Run) => void;
}) {
  const [panels, setPanels] = useState<TablePanel[]>([]);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<TablePanel | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runSearch, setRunSearch] = useState("");
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [downloadMenu, setDownloadMenu] = useState<string | null>(null);
  const resizeDrag = useRef<{
    panelId: string;
    pointerId: number;
    x: number;
    y: number;
    width: number;
    height: number;
    gridWidth: number;
    gap: number;
    previous: PanelLayout | undefined;
  } | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "null",
      );
      setPanels(
        Array.isArray(stored) && stored.every(isPanel)
          ? stored
          : [defaultPanel(project)],
      );
    } catch {
      setPanels([defaultPanel(project)]);
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [project]);
  useEffect(() => {
    if (!ready || resizingId) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
    } catch {
      /* Storage is optional. */
    }
  }, [panels, ready, resizingId]);
  useEffect(() => {
    if (!draft && !expanded) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (draft) setDraft(null);
        else setExpanded(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [draft, expanded]);
  useEffect(() => {
    if (!downloadMenu) return;
    const close = (event: globalThis.PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setDownloadMenu(null);
      } else if (
        !(event.target instanceof Element) ||
        !event.target.closest("[data-table-download]")
      ) {
        setDownloadMenu(null);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [downloadMenu]);

  const allColumns = [
    { key: "run", label: "Run" },
    { key: "state", label: "State" },
    { key: "group", label: "Group" },
    ...(project?.metrics ?? []),
  ];
  const configFields = useMemo(() => tableFields(runs), [runs]);
  const tableData = useMemo(
    () => panels.map((panel) => buildTable(panel, runs, project, configFields)),
    [panels, runs, project, configFields],
  );
  const add = (mode: TablePanel["mode"]) => {
    const id = crypto.randomUUID();
    const panel: TablePanel =
      mode === "pivot"
        ? {
            ...defaultPanel(project),
            id,
            title: `Comparison ${panels.filter((item) => item.mode === "pivot").length + 1}`,
            rowField: configFields.includes("batch_size")
              ? "batch_size"
              : configFields[0],
            columnField: configFields.includes("optimizer")
              ? "optimizer"
              : configFields.find((key) => key !== configFields[0]),
          }
        : mode === "runs"
          ? {
              id,
              title: `Run table ${panels.filter((item) => item.mode === "runs").length + 1}`,
              mode,
              columns: [
                "run",
                "state",
                "group",
                ...(project?.metrics.slice(0, 4).map((metric) => metric.key) ??
                  []),
              ],
              rows: [],
              runIds: null,
            }
          : {
              id,
              title: `Custom table ${panels.filter((item) => item.mode === "manual").length + 1}`,
              mode,
              columns: ["Name", "Value"],
              rows: [["", ""]],
              runIds: null,
            };
    setDraft(panel);
    setRunSearch("");
  };
  const edit = (panel: TablePanel) => {
    setDraft({
      ...panel,
      columns: [...panel.columns],
      rows: panel.rows.map((row) => [...row]),
      runIds: panel.runIds ? [...panel.runIds] : null,
    });
    setRunSearch("");
  };
  const movePanel = (source: string, target: string) => {
    setPanels((previous) => {
      const from = previous.findIndex((item) => item.id === source);
      const to = previous.findIndex((item) => item.id === target);
      if (from < 0 || to < 0 || from === to) return previous;
      const next = [...previous];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  const setPanelLayout = (id: string, layout: PanelLayout | undefined) => {
    setPanels((previous) =>
      previous.map((panel) => (panel.id === id ? { ...panel, layout } : panel)),
    );
  };
  const startResize = (
    event: PointerEvent<HTMLButtonElement>,
    panel: TablePanel,
  ) => {
    const card = event.currentTarget.closest<HTMLElement>(".scalar-panel");
    const grid = card?.parentElement;
    if (!card || !grid) return;
    const style = getComputedStyle(grid);
    const gridWidth =
      grid.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    resizeDrag.current = {
      panelId: panel.id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: card.getBoundingClientRect().width,
      height: card.getBoundingClientRect().height,
      gridWidth,
      gap: parseFloat(style.columnGap) || 16,
      previous: panel.layout,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizingId(panel.id);
  };
  const moveResize = (event: PointerEvent<HTMLButtonElement>) => {
    const start = resizeDrag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const next = resizedPanelLayout(
      { width: start.width, height: start.height },
      { x: event.clientX - start.x, y: event.clientY - start.y },
      start.gridWidth,
      start.gap,
    );
    if (window.matchMedia("(max-width: 760px)").matches)
      next.span = start.previous?.span ?? DEFAULT_TABLE_LAYOUT.span;
    setPanelLayout(start.panelId, next);
  };
  const endResize = (
    event: PointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) => {
    const start = resizeDrag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancelled) setPanelLayout(start.panelId, start.previous);
    resizeDrag.current = null;
    setResizingId(null);
  };

  return (
    <section className="scalar-view" aria-label="Tables">
      <ViewHeader
        title="Tables"
        actions={
          <div className="scalar-add-actions">
            <button className="primary" onClick={() => add("pivot")}>
              <Plus size={16} /> Comparison table
            </button>
            <button className="toolbar-button" onClick={() => add("runs")}>
              <Plus size={16} /> Run table
            </button>
            <button className="toolbar-button" onClick={() => add("manual")}>
              <Plus size={16} /> Custom table
            </button>
          </div>
        }
      />
      <div className="scalar-panel-area">
        {panels.map((panel, panelIndex) => {
          const selectedRuns =
            panel.runIds === null
              ? runs
              : runs.filter((run) => panel.runIds?.includes(run.id));
          const rowField = configFields.includes(panel.rowField ?? "")
            ? panel.rowField!
            : (configFields[0] ?? "");
          const columnField =
            configFields.includes(panel.columnField ?? "") &&
            panel.columnField !== rowField
              ? panel.columnField!
              : (configFields.find((key) => key !== rowField) ?? "");
          const valueMetric =
            project?.metrics.find((metric) => metric.key === panel.valueMetric)
              ?.key ??
            project?.metrics[0]?.key ??
            "";
          const metricLabel =
            project?.metrics.find((metric) => metric.key === valueMetric)
              ?.label ?? valueMetric;
          const pivot = panel.mode === "pivot";
          const { headers, values } = tableData[panelIndex];
          const isExpanded = expanded === panel.id;
          const layout =
            restorePanelLayout(panel.layout) ?? DEFAULT_TABLE_LAYOUT;
          const card = (
            <article
              key={panel.id}
              data-table-panel={panel.id}
              className={`chart-card scalar-panel ${isExpanded ? "scalar-panel-expanded" : ""} ${dropTarget === panel.id ? "chart-drop-target" : ""} ${resizingId === panel.id ? "chart-panel-resizing" : ""}`}
              style={
                isExpanded
                  ? undefined
                  : { gridColumn: `span ${layout.span}`, height: layout.height }
              }
              role={isExpanded ? "dialog" : undefined}
              aria-modal={isExpanded || undefined}
              aria-label={isExpanded ? panel.title : undefined}
              onDragOver={(event) => {
                if (
                  event.dataTransfer.types.includes("application/x-table-panel")
                ) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropTarget(panel.id);
                }
              }}
              onDragLeave={(event) => {
                if (
                  !(event.relatedTarget instanceof Node) ||
                  !event.currentTarget.contains(event.relatedTarget)
                )
                  setDropTarget(null);
              }}
              onDrop={(event) => {
                const source = event.dataTransfer.getData(
                  "application/x-table-panel",
                );
                if (source) {
                  event.preventDefault();
                  movePanel(source, panel.id);
                  setDropTarget(null);
                }
              }}
            >
              {!isExpanded && (
                <button
                  className="chart-drag-handle"
                  draggable
                  title="Drag to move table. Arrow keys also reorder."
                  aria-label={`Move ${panel.title} table`}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/x-table-panel",
                      panel.id,
                    );
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDropTarget(null)}
                  onKeyDown={(event) => {
                    if (
                      ![
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                      ].includes(event.key)
                    )
                      return;
                    event.preventDefault();
                    const offset =
                      event.key === "ArrowLeft" || event.key === "ArrowUp"
                        ? -1
                        : 1;
                    const target =
                      panels[
                        panels.findIndex((item) => item.id === panel.id) +
                          offset
                      ];
                    if (target) movePanel(panel.id, target.id);
                  }}
                >
                  <GripVertical size={16} />
                </button>
              )}
              <div className="scalar-panel-actions">
                <button
                  title={isExpanded ? "Close full screen" : "View full screen"}
                  aria-label={`${isExpanded ? "Close full screen" : "Expand"} ${panel.title}`}
                  onClick={() => setExpanded(isExpanded ? null : panel.id)}
                >
                  {isExpanded ? <Minimize2 /> : <Maximize2 />}
                </button>
                <button
                  title="Edit table"
                  aria-label={`Edit ${panel.title}`}
                  onClick={() => edit(panel)}
                >
                  <Settings />
                </button>
                <div className="scalar-download" data-table-download>
                  <button
                    title="Download table"
                    aria-label={`Download ${panel.title}`}
                    aria-haspopup="menu"
                    aria-expanded={downloadMenu === panel.id}
                    onClick={() =>
                      setDownloadMenu(
                        downloadMenu === panel.id ? null : panel.id,
                      )
                    }
                  >
                    <Download />
                  </button>
                  {downloadMenu === panel.id && (
                    <div
                      className="popover scalar-download-menu"
                      role="menu"
                      aria-label={`Download ${panel.title} as`}
                    >
                      {(["csv", "tsv", "json", "png"] as const).map(
                        (format) => (
                          <button
                            key={format}
                            role="menuitem"
                            onClick={() => {
                              try {
                                exportTable(
                                  panel.title,
                                  headers,
                                  values,
                                  format,
                                );
                              } catch (error) {
                                window.alert(
                                  error instanceof Error
                                    ? error.message
                                    : "Unable to export table.",
                                );
                              }
                              setDownloadMenu(null);
                            }}
                          >
                            Download {format.toUpperCase()}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>
                <button
                  title="Delete table"
                  aria-label={`Delete ${panel.title}`}
                  onClick={() => {
                    setPanels((previous) =>
                      previous.filter((item) => item.id !== panel.id),
                    );
                    setExpanded(null);
                  }}
                >
                  <Trash2 />
                </button>
              </div>
              <h3>
                <button
                  className="chart-title-button"
                  onClick={() => edit(panel)}
                >
                  {panel.title}
                </button>
              </h3>
              <div className="scalar-panel-meta">
                {pivot
                  ? `${metricLabel} · ${panel.aggregation ?? "mean"}${(panel.aggregation ?? "mean") === "mean" && panel.uncertainty && panel.uncertainty !== "none" ? (panel.uncertainty === "range" ? " · min/max range" : ` ± ${panel.uncertainty === "stddev" ? "std dev" : "std err"}`) : ""} · ${selectedRuns.length} runs`
                  : panel.mode === "runs"
                    ? `${selectedRuns.length} runs`
                    : `${values.length} rows`}{" "}
                · {headers.length} columns
              </div>
              <div className="scalar-panel-scroll">
                {pivot && configFields.length < 2 ? (
                  <div className="empty-state">
                    Comparison tables need two varying configuration fields.
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        {headers.map((header, index) => (
                          <th
                            key={index}
                            className={
                              pivot && index === 0
                                ? "scalar-pivot-corner"
                                : undefined
                            }
                          >
                            {pivot && index === 0 ? (
                              <>
                                {fieldLabel(rowField)} ↓<br />
                                {fieldLabel(columnField)} →
                              </>
                            ) : (
                              header || `Column ${index + 1}`
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {values.map((row, rowIndex) => (
                        <tr
                          key={
                            panel.mode === "runs"
                              ? selectedRuns[rowIndex].id
                              : rowIndex
                          }
                        >
                          {row.map((value, columnIndex) => (
                            <td
                              key={columnIndex}
                              className={
                                pivot
                                  ? columnIndex === 0
                                    ? "scalar-pivot-row"
                                    : "scalar-pivot-value"
                                  : undefined
                              }
                            >
                              {panel.mode === "runs" &&
                              panel.columns[columnIndex] === "run" ? (
                                <button
                                  className="scalar-run-name"
                                  onClick={() =>
                                    onOpenRun(selectedRuns[rowIndex])
                                  }
                                >
                                  <span
                                    className="run-dot"
                                    style={{
                                      background: selectedRuns[rowIndex].color,
                                    }}
                                  />
                                  {value}
                                </button>
                              ) : panel.mode === "runs" &&
                                panel.columns[columnIndex] === "state" ? (
                                <span className={`status ${value}`}>
                                  {value}
                                </span>
                              ) : (
                                value || "—"
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {!values.length && (!pivot || configFields.length >= 2) && (
                  <div className="empty-state">
                    No rows. Edit this table to add or select rows.
                  </div>
                )}
              </div>
              {!isExpanded && (
                <button
                  className="chart-resize-handle"
                  aria-label={`Resize ${panel.title} table`}
                  title="Drag to resize. Arrow keys adjust size; Home or double-click restores the default."
                  onPointerDown={(event) => startResize(event, panel)}
                  onPointerMove={moveResize}
                  onPointerUp={(event) => endResize(event)}
                  onPointerCancel={(event) => endResize(event, true)}
                  onDoubleClick={() => setPanelLayout(panel.id, undefined)}
                  onKeyDown={(event) => {
                    if (event.key === "Home") {
                      event.preventDefault();
                      setPanelLayout(panel.id, undefined);
                      return;
                    }
                    if (
                      ![
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                      ].includes(event.key)
                    )
                      return;
                    const card =
                      event.currentTarget.closest<HTMLElement>(".scalar-panel");
                    const grid = card?.parentElement;
                    if (!card || !grid) return;
                    event.preventDefault();
                    const style = getComputedStyle(grid);
                    const gap = parseFloat(style.columnGap) || 16;
                    const gridWidth =
                      grid.clientWidth -
                      parseFloat(style.paddingLeft) -
                      parseFloat(style.paddingRight);
                    const unit = (gridWidth + gap) / 12;
                    const next = resizedPanelLayout(
                      {
                        width: card.getBoundingClientRect().width,
                        height: card.getBoundingClientRect().height,
                      },
                      {
                        x:
                          event.key === "ArrowLeft"
                            ? -unit
                            : event.key === "ArrowRight"
                              ? unit
                              : 0,
                        y:
                          event.key === "ArrowUp"
                            ? -24
                            : event.key === "ArrowDown"
                              ? 24
                              : 0,
                      },
                      gridWidth,
                      gap,
                    );
                    if (window.matchMedia("(max-width: 760px)").matches)
                      next.span = layout.span;
                    setPanelLayout(panel.id, next);
                  }}
                />
              )}
            </article>
          );
          return isExpanded
            ? createPortal(
                <div
                  key={panel.id}
                  className="scalar-panel-backdrop"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setExpanded(null);
                  }}
                >
                  {card}
                </div>,
                document.body,
              )
            : card;
        })}
        {ready && !panels.length && (
          <div className="empty-state">
            No tables yet. Add a run table or a custom table.
          </div>
        )}
      </div>
      {draft &&
        createPortal(
          <div
            className="scalar-editor-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDraft(null);
            }}
          >
            <div
              className="scalar-editor"
              role="dialog"
              aria-modal="true"
              aria-label={`Edit ${draft.title}`}
            >
              <div className="scalar-editor-heading">
                <div>
                  <h2>Edit table</h2>
                  <p>
                    {draft.mode === "pivot"
                      ? "Choose the row field, column field, and cell value."
                      : draft.mode === "runs"
                        ? "Choose run rows and result columns."
                        : "Edit column names and cell values."}
                  </p>
                </div>
                <button
                  aria-label="Close table editor"
                  onClick={() => setDraft(null)}
                >
                  <X />
                </button>
              </div>
              <div className="scalar-editor-body">
                <label className="scalar-title-field">
                  Title
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                  />
                </label>
                {draft.mode === "pivot" ? (
                  <div className="scalar-pivot-settings">
                    <label>
                      Rows
                      <select
                        aria-label="Table rows"
                        value={
                          configFields.includes(draft.rowField ?? "")
                            ? draft.rowField
                            : (configFields[0] ?? "")
                        }
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            rowField: event.target.value,
                            columnField:
                              draft.columnField === event.target.value
                                ? configFields.find(
                                    (key) => key !== event.target.value,
                                  )
                                : draft.columnField,
                          })
                        }
                      >
                        {configFields.map((field) => (
                          <option key={field} value={field}>
                            {fieldLabel(field)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Columns
                      <select
                        aria-label="Table columns"
                        value={
                          configFields.includes(draft.columnField ?? "") &&
                          draft.columnField !== draft.rowField
                            ? draft.columnField
                            : (configFields.find(
                                (key) => key !== draft.rowField,
                              ) ?? "")
                        }
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            columnField: event.target.value,
                          })
                        }
                      >
                        {configFields
                          .filter((field) => field !== draft.rowField)
                          .map((field) => (
                            <option key={field} value={field}>
                              {fieldLabel(field)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Value
                      <select
                        aria-label="Table value"
                        value={
                          draft.valueMetric ?? project?.metrics[0]?.key ?? ""
                        }
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            valueMetric: event.target.value,
                          })
                        }
                      >
                        {project?.metrics.map((metric) => (
                          <option key={metric.key} value={metric.key}>
                            {metric.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Aggregate
                      <select
                        aria-label="Table aggregation"
                        value={draft.aggregation ?? "mean"}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            aggregation: event.target
                              .value as TablePanel["aggregation"],
                          })
                        }
                      >
                        <option value="mean">Mean</option>
                        <option value="min">Minimum</option>
                        <option value="max">Maximum</option>
                      </select>
                    </label>
                    <label>
                      Uncertainty
                      <select
                        aria-label="Table uncertainty"
                        value={draft.uncertainty ?? "none"}
                        disabled={(draft.aggregation ?? "mean") !== "mean"}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            uncertainty: event.target
                              .value as TablePanel["uncertainty"],
                          })
                        }
                      >
                        <option value="none">None</option>
                        <option value="stddev">Standard deviation</option>
                        <option value="stderr">Standard error</option>
                        <option value="range">Min–max range</option>
                      </select>
                    </label>
                    <p>
                      Each cell summarizes the latest result from matching runs.
                      Uncertainty uses the runs in that cell; a single run shows
                      only its mean. Empty combinations show —.
                    </p>
                  </div>
                ) : draft.mode === "runs" ? (
                  <>
                    <div className="scalar-editor-section">
                      <h3>Columns</h3>
                      <div className="scalar-choice-list">
                        {allColumns.map((column) => (
                          <label key={column.key}>
                            <input
                              type="checkbox"
                              checked={draft.columns.includes(column.key)}
                              onChange={() =>
                                setDraft({
                                  ...draft,
                                  columns: draft.columns.includes(column.key)
                                    ? draft.columns.filter(
                                        (key) => key !== column.key,
                                      )
                                    : [...draft.columns, column.key],
                                })
                              }
                            />
                            {column.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="scalar-editor-section">
                      <div className="scalar-section-heading">
                        <h3>Rows</h3>
                        <button
                          className="toolbar-button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              runIds: draft.runIds === null ? [] : null,
                            })
                          }
                        >
                          {draft.runIds === null
                            ? "Select specific runs"
                            : "Use all filtered runs"}
                        </button>
                      </div>
                      {draft.runIds === null ? (
                        <p>
                          All {runs.length} currently filtered runs are
                          included.
                        </p>
                      ) : (
                        <>
                          <input
                            className="scalar-run-search"
                            placeholder="Find a run"
                            aria-label="Find a run"
                            value={runSearch}
                            onChange={(event) =>
                              setRunSearch(event.target.value)
                            }
                          />
                          <div className="scalar-run-list">
                            {runs
                              .filter((run) =>
                                run.name
                                  .toLowerCase()
                                  .includes(runSearch.toLowerCase()),
                              )
                              .map((run) => (
                                <label key={run.id}>
                                  <input
                                    type="checkbox"
                                    checked={
                                      draft.runIds?.includes(run.id) ?? false
                                    }
                                    onChange={() =>
                                      setDraft({
                                        ...draft,
                                        runIds: draft.runIds?.includes(run.id)
                                          ? draft.runIds.filter(
                                              (id) => id !== run.id,
                                            )
                                          : [...(draft.runIds ?? []), run.id],
                                      })
                                    }
                                  />
                                  {run.name}
                                </label>
                              ))}
                          </div>
                          <p>{draft.runIds.length} selected</p>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="scalar-editor-section">
                    <div className="scalar-section-heading">
                      <h3>Rows and columns</h3>
                      <div>
                        <button
                          className="toolbar-button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              columns: [
                                ...draft.columns,
                                `Column ${draft.columns.length + 1}`,
                              ],
                              rows: draft.rows.map((row) => [...row, ""]),
                            })
                          }
                        >
                          <Plus size={15} /> Column
                        </button>
                        <button
                          className="toolbar-button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              rows: [
                                ...draft.rows,
                                draft.columns.map(() => ""),
                              ],
                            })
                          }
                        >
                          <Plus size={15} /> Row
                        </button>
                      </div>
                    </div>
                    <div className="scalar-editor-grid">
                      <table>
                        <thead>
                          <tr>
                            {draft.columns.map((column, index) => (
                              <th key={index}>
                                <div className="scalar-edit-cell">
                                  <input
                                    aria-label={`Column ${index + 1} name`}
                                    value={column}
                                    onChange={(event) =>
                                      setDraft({
                                        ...draft,
                                        columns: draft.columns.map(
                                          (item, itemIndex) =>
                                            itemIndex === index
                                              ? event.target.value
                                              : item,
                                        ),
                                      })
                                    }
                                  />
                                  <button
                                    aria-label={`Remove column ${index + 1}`}
                                    disabled={draft.columns.length <= 1}
                                    onClick={() =>
                                      setDraft({
                                        ...draft,
                                        columns: draft.columns.filter(
                                          (_, itemIndex) => itemIndex !== index,
                                        ),
                                        rows: draft.rows.map((row) =>
                                          row.filter(
                                            (_, itemIndex) =>
                                              itemIndex !== index,
                                          ),
                                        ),
                                      })
                                    }
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </th>
                            ))}
                            <th> </th>
                          </tr>
                        </thead>
                        <tbody>
                          {draft.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {draft.columns.map((_, columnIndex) => (
                                <td key={columnIndex}>
                                  <input
                                    aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                                    value={row[columnIndex] ?? ""}
                                    onChange={(event) =>
                                      setDraft({
                                        ...draft,
                                        rows: draft.rows.map(
                                          (item, itemIndex) =>
                                            itemIndex === rowIndex
                                              ? item.map((cell, cellIndex) =>
                                                  cellIndex === columnIndex
                                                    ? event.target.value
                                                    : cell,
                                                )
                                              : item,
                                        ),
                                      })
                                    }
                                  />
                                </td>
                              ))}
                              <td>
                                <button
                                  aria-label={`Remove row ${rowIndex + 1}`}
                                  onClick={() =>
                                    setDraft({
                                      ...draft,
                                      rows: draft.rows.filter(
                                        (_, index) => index !== rowIndex,
                                      ),
                                    })
                                  }
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="scalar-editor-footer">
                <button
                  className="toolbar-button"
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </button>
                <button
                  className="primary"
                  disabled={
                    !draft.title.trim() ||
                    (draft.mode !== "pivot" && !draft.columns.length) ||
                    (draft.mode === "pivot" && configFields.length < 2)
                  }
                  onClick={() => {
                    setPanels((previous) =>
                      previous.some((panel) => panel.id === draft.id)
                        ? previous.map((panel) =>
                            panel.id === draft.id
                              ? { ...draft, title: draft.title.trim() }
                              : panel,
                          )
                        : [
                            ...previous,
                            { ...draft, title: draft.title.trim() },
                          ],
                    );
                    setDraft(null);
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
