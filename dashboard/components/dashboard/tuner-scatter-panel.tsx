"use client";

import { useRef, useState, type PointerEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  GripVertical,
  Hand,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  MousePointer2,
  RotateCcw,
  Settings,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { downloadBlob } from "@/lib/download";
import { compact } from "@/lib/data/chart-model";
import {
  MAX_PANEL_COLUMNS,
  MAX_PANEL_HEIGHT,
  MIN_PANEL_HEIGHT,
  resizedUniformPanelLayout,
  type UniformPanelLayout,
} from "@/lib/data/panel-layout";

export type TunerPlotPoint = {
  runId: string;
  x: number;
  y: number;
  value: string;
  trial: number;
  name: string;
  color: string;
};

export default function TunerScatterPanel({
  label,
  spaceLabel,
  objectiveLabel,
  points,
  selectedIds,
  onToggleTrial,
  onSelectAll,
  values,
  numeric,
  domain,
  ticks,
  minTrial,
  maxTrial,
  plotKey,
  layout,
  onLayoutChange,
  onMove,
  onMoveByOffset,
}: {
  label: string;
  spaceLabel: string;
  objectiveLabel: string;
  points: TunerPlotPoint[];
  selectedIds: Set<string>;
  onToggleTrial: (id: string) => void;
  onSelectAll: () => void;
  values: string[];
  numeric: boolean;
  domain: [number, number];
  ticks?: number[];
  minTrial: number;
  maxTrial: number;
  plotKey: string;
  layout: UniformPanelLayout;
  onLayoutChange: (layout: UniformPanelLayout | null) => void;
  onMove: (source: string, target: string) => void;
  onMoveByOffset: (offset: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editor, setEditor] = useState(false);
  const [mode, setMode] = useState<"inspect" | "zoom" | "pan">("inspect");
  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [viewport, setViewport] = useState<[number, number] | null>(null);
  const [resizing, setResizing] = useState(false);
  const [layoutAnnouncement, setLayoutAnnouncement] = useState("");
  const [dropTarget, setDropTarget] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const resizeStart = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    columns: number;
    gridWidth: number;
    gap: number;
    narrow: boolean;
    previous: UniformPanelLayout;
  } | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const shownDomain = viewport ?? domain;
  const span = shownDomain[1] - shownDomain[0] || 1;
  const adjustZoom = (factor: number) => {
    const center = (shownDomain[0] + shownDomain[1]) / 2;
    const half = (span * factor) / 2;
    setViewport([center - half, center + half]);
  };
  const pan = (fraction: number) =>
    setViewport([
      shownDomain[0] + span * fraction,
      shownDomain[1] + span * fraction,
    ]);
  const reset = () => setViewport(null);
  const safeName = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const exportCsv = () => {
    const rows = [
      ["trial", "run", label, objectiveLabel],
      ...points.map((point) => [
        String(point.trial),
        point.name,
        point.value,
        String(point.y),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `${safeName}-trials.csv`,
    );
    setMenu(false);
  };
  const exportImage = async (format: "svg" | "png") => {
    const svg = plotRef.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const bounds = svg.getBoundingClientRect();
    clone.setAttribute("width", String(Math.round(bounds.width)));
    clone.setAttribute("height", String(Math.round(bounds.height)));
    const source = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    if (format === "svg") downloadBlob(svgBlob, `${safeName}-trials.svg`);
    else {
      const url = URL.createObjectURL(svgBlob);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bounds.width * 2));
        canvas.height = Math.max(1, Math.round(bounds.height * 2));
        const context = canvas.getContext("2d");
        if (!context) return;
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (blob) downloadBlob(blob, `${safeName}-trials.png`);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    setMenu(false);
  };
  const onPointerUp = (clientX: number) => {
    if (dragStart.current === null || !plotRef.current) return;
    const rect = plotRef.current.getBoundingClientRect();
    const width = Math.max(1, rect.width - 68);
    const delta = (clientX - dragStart.current) / width;
    if (mode === "zoom" && Math.abs(delta) > 0.025) {
      const first = Math.max(
        0,
        Math.min(1, (dragStart.current - rect.left - 54) / width),
      );
      const last = Math.max(0, Math.min(1, (clientX - rect.left - 54) / width));
      if (Math.abs(last - first) > 0.025)
        setViewport([
          shownDomain[0] + Math.min(first, last) * span,
          shownDomain[0] + Math.max(first, last) * span,
        ]);
    } else if (mode === "pan" && Math.abs(delta) > 0.005) pan(-delta);
    dragStart.current = null;
  };
  const beginResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const rect = panelRef.current?.getBoundingClientRect();
    const grid = panelRef.current?.parentElement;
    if (!rect || !grid) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStart.current = {
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height,
      columns: layout.columns,
      gridWidth: grid.getBoundingClientRect().width,
      gap: parseFloat(getComputedStyle(grid).columnGap) || 0,
      narrow: window.matchMedia("(max-width: 720px)").matches,
      previous: layout,
    };
    setResizing(true);
  };
  const moveResize = (event: PointerEvent<HTMLButtonElement>) => {
    const start = resizeStart.current;
    if (!start) return;
    onLayoutChange(
      resizedUniformPanelLayout(
        start,
        { x: event.clientX - start.x, y: event.clientY - start.y },
        start.gridWidth,
        start.gap,
        start.narrow,
      ),
    );
  };
  const endResize = (
    event: PointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) => {
    const start = resizeStart.current;
    if (!start) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    resizeStart.current = null;
    setResizing(false);
    const next = cancelled
      ? start.previous
      : resizedUniformPanelLayout(
          start,
          { x: event.clientX - start.x, y: event.clientY - start.y },
          start.gridWidth,
          start.gap,
          start.narrow,
        );
    onLayoutChange(next);
    setLayoutAnnouncement(
      `All tuning graphs: up to ${next.columns} per row, height ${next.height} pixels.`,
    );
  };
  const resetLayout = () => {
    onLayoutChange(null);
    setLayoutAnnouncement("Default size restored for all tuning graphs.");
  };

  return (
    <section
      ref={panelRef}
      className={`chart-card chart-card-interactive tuner-plot-card ${expanded ? "chart-expanded" : ""} ${resizing ? "chart-panel-resizing" : ""} ${dropTarget ? "chart-drop-target" : ""}`}
      style={expanded ? undefined : { height: layout.height }}
      data-metric={plotKey}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("application/x-tuner-panel")) {
          event.preventDefault();
          setDropTarget(true);
        }
      }}
      onDragLeave={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          setDropTarget(false);
      }}
      onDrop={(event) => {
        const source = event.dataTransfer.getData("application/x-tuner-panel");
        if (!source) return;
        event.preventDefault();
        setDropTarget(false);
        onMove(source, plotKey);
      }}
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded || undefined}
      aria-label={expanded ? `Expanded ${label} chart` : undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setExpanded(false);
          setEditor(false);
          setMenu(false);
        }
      }}
    >
      {!expanded && (
        <button
          className="chart-drag-handle"
          draggable
          aria-label={`Move ${label} panel`}
          title="Drag panel. Use arrow keys to reorder."
          onDragStart={(event) => {
            event.dataTransfer.setData("application/x-tuner-panel", plotKey);
            event.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => setDropTarget(false)}
          onKeyDown={(event) => {
            if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
              event.preventDefault();
              onMoveByOffset(-1);
            } else if (["ArrowRight", "ArrowDown"].includes(event.key)) {
              event.preventDefault();
              onMoveByOffset(1);
            }
          }}
        >
          <GripVertical size={16} />
        </button>
      )}
      <div className="chart-actions">
        <button
          aria-label={
            expanded ? `Restore ${label} chart` : `Expand ${label} chart`
          }
          title={expanded ? "Restore chart" : "View full screen"}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <Minimize2 /> : <Maximize2 />}
        </button>
        <button
          aria-label={`Edit ${label} panel`}
          title="Edit panel"
          onClick={() => {
            setEditor((value) => !value);
            setMenu(false);
          }}
        >
          <Settings />
        </button>
        <button
          aria-label={`Options for ${label}`}
          title="More panel actions"
          aria-expanded={menu}
          onClick={() => {
            setMenu((value) => !value);
            setEditor(false);
          }}
        >
          <MoreHorizontal />
        </button>
      </div>
      {menu && (
        <div
          className="popover chart-menu"
          role="menu"
          aria-label={`Actions for ${label}`}
        >
          <button
            role="menuitem"
            onClick={() => {
              setEditor(true);
              setMenu(false);
            }}
          >
            <Settings size={16} /> Edit panel
          </button>
          <button
            role="menuitem"
            onClick={() => {
              reset();
              setMenu(false);
            }}
          >
            <RotateCcw size={16} /> Reset chart view
          </button>
          <button role="menuitem" onClick={exportCsv}>
            <Download size={16} /> Download CSV
          </button>
          <button role="menuitem" onClick={() => void exportImage("svg")}>
            <Download size={16} /> Download SVG
          </button>
          <button role="menuitem" onClick={() => void exportImage("png")}>
            <Download size={16} /> Download PNG
          </button>
        </div>
      )}
      {editor && (
        <div
          className="popover chart-menu tuner-plot-settings"
          aria-label={`${label} plot settings`}
        >
          <strong>Plot settings</strong>
          <label>
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(event) => setShowGrid(event.target.checked)}
            />{" "}
            Show grid
          </label>
          <label>
            <input
              type="checkbox"
              checked={showLegend}
              onChange={(event) => setShowLegend(event.target.checked)}
            />{" "}
            Show trial legend
          </label>
          <button onClick={() => setEditor(false)}>Done</button>
        </div>
      )}
      <div
        className="chart-interaction-toolbar"
        aria-label={`Plot controls for ${label}`}
      >
        <button
          aria-label={`Inspect ${label}`}
          title="Inspect values"
          aria-pressed={mode === "inspect"}
          onClick={() => setMode("inspect")}
        >
          <MousePointer2 />
        </button>
        <button
          aria-label={`Select zoom ${label}`}
          title="Drag to zoom horizontal axis"
          aria-pressed={mode === "zoom"}
          onClick={() => setMode("zoom")}
        >
          <ZoomIn />
        </button>
        <button
          aria-label={`Pan ${label}`}
          title="Drag to pan horizontal axis"
          aria-pressed={mode === "pan"}
          onClick={() => setMode("pan")}
        >
          <Hand />
        </button>
        <span className="chart-toolbar-separator" />
        <button
          aria-label={`Zoom in ${label}`}
          title="Zoom in"
          onClick={() => adjustZoom(0.65)}
        >
          <ZoomIn />
        </button>
        <button
          aria-label={`Zoom out ${label}`}
          title="Zoom out"
          onClick={() => adjustZoom(1 / 0.65)}
        >
          <ZoomOut />
        </button>
        <button
          aria-label={`Pan left ${label}`}
          title="Pan left"
          onClick={() => pan(-0.25)}
        >
          <ArrowLeft />
        </button>
        <button
          aria-label={`Pan right ${label}`}
          title="Pan right"
          onClick={() => pan(0.25)}
        >
          <ArrowRight />
        </button>
        <button
          aria-label={`Reset zoom ${label}`}
          title="Reset axes"
          disabled={!viewport}
          onClick={reset}
        >
          <RotateCcw />
        </button>
      </div>
      <h3>
        <button className="chart-title-button" onClick={() => setEditor(true)}>
          {label}
        </button>
      </h3>
      <div className="tuner-plot-space">{spaceLabel}</div>
      {points.length ? (
        <div className="tuner-plot-body">
          <div
            className={`chart-plot tuner-plot-chart chart-mode-${mode}`}
            role="group"
            aria-label={`Interactive plot ${label}`}
            ref={plotRef}
            onPointerDown={(event) => {
              if (mode !== "inspect") dragStart.current = event.clientX;
            }}
            onPointerUp={(event) => onPointerUp(event.clientX)}
            onPointerCancel={() => {
              dragStart.current = null;
            }}
            onDoubleClick={reset}
            onClick={onSelectAll}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ScatterChart margin={{ top: 10, right: 8, bottom: 28, left: 6 }}>
                {showGrid && (
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                )}
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={shownDomain}
                  allowDataOverflow
                  ticks={viewport ? undefined : ticks}
                  tickFormatter={(value: number) =>
                    numeric ? compact(value) : (values[Math.round(value)] ?? "")
                  }
                  tick={{ fontSize: 11 }}
                  label={{
                    value: label,
                    position: "insideBottom",
                    offset: -15,
                    fontSize: 12,
                  }}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  domain={["auto", "auto"]}
                  tickFormatter={compact}
                  tick={{ fontSize: 11 }}
                  width={44}
                  label={{
                    value: "Objective Value",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as TunerPlotPoint;
                    return (
                      <div className="tuner-tooltip">
                        <strong>
                          {point.name} · Trial #{point.trial}
                        </strong>
                        <span>
                          {label}: {point.value}
                        </span>
                        <span>
                          {objectiveLabel}: {compact(point.y)}
                        </span>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={points}
                  dataKey="y"
                  isAnimationActive={false}
                  onClick={(point, _index, event) => {
                    event.stopPropagation();
                    if (
                      mode === "inspect" &&
                      typeof point.payload?.runId === "string"
                    )
                      onToggleTrial(point.payload.runId);
                  }}
                >
                  {points.map((point) => (
                    <Cell
                      key={point.runId}
                      fill={point.color}
                      fillOpacity={selectedIds.has(point.runId) ? 1 : 0.13}
                      stroke={
                        selectedIds.has(point.runId)
                          ? "var(--theme-text, #25364a)"
                          : "none"
                      }
                      strokeWidth={selectedIds.has(point.runId) ? 1.5 : 0}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          {showLegend && (
            <div className="tuner-trial-legend">
              <span>Trial</span>
              <div className="tuner-trial-legend-scale">
                <span>{maxTrial}</span>
                <i />
                <span>{minTrial}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="tuner-chart-empty">
          No objective values for this parameter.
        </div>
      )}
      {!expanded && (
        <span className="chart-layout-announcement" role="status">
          {layoutAnnouncement}
        </span>
      )}
      {!expanded && (
        <button
          className="chart-resize-handle"
          aria-label={`Resize ${label} panel`}
          title="Drag to resize all tuning graphs. Arrow keys adjust size; double-click or Home restores the default."
          onPointerDown={beginResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={(event) => endResize(event, true)}
          onDoubleClick={resetLayout}
          onKeyDown={(event) => {
            if (event.key === "Home") {
              event.preventDefault();
              resetLayout();
              return;
            }
            if (
              !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                event.key,
              )
            )
              return;
            const grid = panelRef.current?.parentElement;
            if (!grid) return;
            event.preventDefault();
            const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
            const maximum = Math.max(
              1,
              Math.min(
                MAX_PANEL_COLUMNS,
                Math.floor(
                  (grid.getBoundingClientRect().width + gap) / (240 + gap),
                ),
              ),
            );
            const next = {
              columns:
                window.matchMedia("(max-width: 720px)").matches ||
                event.key === "ArrowUp" ||
                event.key === "ArrowDown"
                  ? layout.columns
                  : Math.max(
                      1,
                      Math.min(
                        maximum,
                        Math.min(maximum, layout.columns) +
                          (event.key === "ArrowLeft" ? 1 : -1),
                      ),
                    ),
              height: Math.max(
                MIN_PANEL_HEIGHT,
                Math.min(
                  MAX_PANEL_HEIGHT,
                  layout.height +
                    (event.key === "ArrowDown"
                      ? 24
                      : event.key === "ArrowUp"
                        ? -24
                        : 0),
                ),
              ),
            };
            onLayoutChange(next);
            setLayoutAnnouncement(
              `All tuning graphs: up to ${next.columns} per row, height ${next.height} pixels.`,
            );
          }}
        />
      )}
    </section>
  );
}
