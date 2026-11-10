"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Hand,
  GripVertical,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  MousePointer2,
  RotateCcw,
  Settings,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { MetricDefinition, MetricPoint } from "@/lib/data";
import {
  buildChartData,
  compact,
  configuredRange,
  dataRange,
  defaultChartSettings,
  restoreChartSettings,
  zoomRange,
  selectedRange,
  panRange,
  legendLabel,
  linearTicks,
  type AxisRange,
  type ChartSettings,
  type PlotRow,
  type PlotSeries,
  type Series,
} from "@/lib/data/chart-model";
import { downloadBlob } from "@/lib/download";
import ChartSettingsEditor from "./chart-settings";
import {
  PANEL_GRID_UNITS,
  resizedPanelLayout,
  restorePanelLayout,
  type PanelLayout,
  type UniformPanelLayout,
  resizedUniformPanelLayout,
  MAX_PANEL_COLUMNS,
  MIN_PANEL_HEIGHT,
  MAX_PANEL_HEIGHT,
} from "@/lib/data/panel-layout";

export { compact } from "@/lib/data/chart-model";
export type { Series } from "@/lib/data/chart-model";
const EMPTY_METRICS: MetricDefinition[] = [];
const MARGIN = { top: 8, right: 14, bottom: 18, left: 0 };
const Y_WIDTH = 44,
  X_HEIGHT = 32;
type Viewport = { x: AxisRange; y: AxisRange };

function xText(value: number, settings: ChartSettings) {
  if (settings.xFormat === "scientific") return value.toExponential(1);
  if (settings.xFormat === "duration")
    return Math.abs(value) >= 3600
      ? `${+(value / 3600).toPrecision(3)}h`
      : Math.abs(value) >= 60
        ? `${+(value / 60).toPrecision(3)}m`
        : `${+value.toPrecision(3)}s`;
  if (settings.xAxis === "timestamp" && !settings.xExpression)
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  return compact(value);
}
function xLabel(settings: ChartSettings) {
  return (
    settings.xLabel ||
    (settings.xExpression
      ? settings.xExpression
      : settings.xAxis === "runtime"
        ? "Relative time (s)"
        : settings.xAxis === "timestamp"
          ? "Wall time"
          : settings.xAxis.startsWith("metric:")
            ? settings.xAxis.slice(7)
            : "Step")
  );
}
function percentageData(data: PlotRow[], lines: PlotSeries[]) {
  return data.map((row) => {
    const result = { ...row };
    const total = lines.reduce(
      (sum, line) =>
        sum +
        (typeof row[line.key] === "number" ? (row[line.key] as number) : 0),
      0,
    );
    for (const line of lines)
      if (typeof row[line.key] === "number")
        result[line.key] =
          total > 0 ? ((row[line.key] as number) / total) * 100 : null;
    return result;
  });
}

const PlotCanvas = memo(function PlotCanvas({
  data,
  lines,
  settings,
  domain,
  onSelectLine,
  selectedRunIds,
}: {
  data: PlotRow[];
  lines: PlotSeries[];
  settings: ChartSettings;
  domain: Viewport;
  onSelectLine?: (id: string) => void;
  selectedRunIds?: string[];
}) {
  const lineOpacity = (line: PlotSeries) =>
    selectedRunIds && !line.runIds.some((id) => selectedRunIds.includes(id))
      ? 0.13
      : 1;
  const fontSize =
    settings.fontSize === "large"
      ? 16
      : settings.fontSize === "medium"
        ? 14
        : 13;
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      minWidth={0}
      initialDimension={{ width: 320, height: 300 }}
      debounce={60}
    >
      <ComposedChart data={data} margin={MARGIN} accessibilityLayer>
        {settings.showGrid && (
          <CartesianGrid stroke="#e6e8eb" vertical={false} />
        )}
        <XAxis
          dataKey="x"
          type="number"
          scale={settings.xScale === "log" ? "log" : "linear"}
          domain={domain.x}
          allowDataOverflow
          height={X_HEIGHT}
          tickFormatter={(value) => xText(value, settings)}
          tick={{ fill: "#696c72", fontSize }}
          tickLine={{ stroke: "#d1d5da", strokeWidth: 0.6 }}
          axisLine={{ stroke: "#d1d5da" }}
          minTickGap={18}
          tickCount={11}
          label={{
            value: xLabel(settings),
            position: "insideBottomRight",
            offset: -8,
            fill: "#707986",
            fontSize,
          }}
        />
        <YAxis
          width={Y_WIDTH}
          scale={settings.yScale}
          tickCount={8}
          ticks={
            settings.yScale === "linear" ? linearTicks(domain.y) : undefined
          }
          tickFormatter={(value) =>
            Number.isFinite(value) ? String(+Number(value).toPrecision(5)) : ""
          }
          tick={{ fill: "#696c72", fontSize }}
          tickLine={false}
          axisLine={false}
          domain={domain.y}
          allowDataOverflow
          label={
            settings.yLabel
              ? {
                  value: settings.yLabel,
                  angle: -90,
                  position: "insideLeft",
                  fill: "#707986",
                  fontSize,
                }
              : undefined
          }
        />
        <Tooltip
          trigger={settings.tooltip}
          isAnimationActive={false}
          filterNull
          cursor={{ stroke: "#9ba8bc", strokeDasharray: "3 3" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="metric-tooltip">
                <strong>
                  {xLabel(settings)}:{" "}
                  {settings.xAxis === "timestamp" && !settings.xExpression
                    ? new Date(Number(label)).toLocaleString()
                    : Number(label).toLocaleString(undefined, {
                        maximumSignificantDigits: 9,
                      })}
                </strong>
                {lines.map((line) => {
                  const entry = payload.find(
                    (value) => value.dataKey === line.key,
                  );
                  if (typeof entry?.value !== "number") return null;
                  return (
                    <div className="metric-tooltip-row" key={line.id}>
                      <span style={{ color: line.color }}>●</span>
                      <span>{legendLabel(line, settings)}</span>
                      <b>
                        {entry.value.toLocaleString(undefined, {
                          maximumSignificantDigits: 7,
                        })}
                        {settings.chartType === "percent-area" ? "%" : ""}
                      </b>
                    </div>
                  );
                })}
              </div>
            ) : null
          }
        />
        {settings.chartType !== "percent-area" &&
          settings.band !== "none" &&
          lines.map((line) => (
            <Area
              key={`${line.key}-band`}
              opacity={lineOpacity(line)}
              className={`plot-series plot-series-${line.key}`}
              onClick={onSelectLine ? () => onSelectLine(line.id) : undefined}
              dataKey={`${line.key}_range`}
              type="linear"
              stroke="none"
              fill={line.color}
              fillOpacity={0.13}
              isAnimationActive={false}
              tooltipType="none"
              connectNulls={settings.connectMissing}
            />
          ))}
        {settings.showRaw &&
          settings.smoothingMethod !== "none" &&
          settings.chartType !== "percent-area" &&
          lines.map((line) => (
            <Line
              key={`${line.key}-raw`}
              opacity={lineOpacity(line)}
              className={`plot-series plot-series-${line.key}`}
              onClick={onSelectLine ? () => onSelectLine(line.id) : undefined}
              dataKey={`${line.key}_raw`}
              type="linear"
              stroke={line.color}
              strokeWidth={1}
              strokeOpacity={0.3}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              tooltipType="none"
              connectNulls={settings.connectMissing}
            />
          ))}
        {lines.map((line) =>
          settings.chartType === "line" ? (
            <Line
              key={line.key}
              opacity={lineOpacity(line)}
              className={`plot-series plot-series-${line.key}`}
              onClick={onSelectLine ? () => onSelectLine(line.id) : undefined}
              dataKey={line.key}
              name={line.name}
              type="linear"
              stroke={line.color}
              strokeWidth={
                settings.seriesStyles[line.id]?.width ?? settings.lineWidth
              }
              strokeDasharray={
                line.metricIndex ? `${3 + line.metricIndex * 2} 3` : undefined
              }
              dot={settings.showPoints ? { r: 2, strokeWidth: 0 } : false}
              activeDot={{
                r: 3,
                opacity: lineOpacity(line),
                pointerEvents: selectedRunIds ? "none" : undefined,
              }}
              isAnimationActive={false}
              connectNulls={settings.connectMissing}
            />
          ) : (
            <Area
              key={line.key}
              opacity={lineOpacity(line)}
              className={`plot-series plot-series-${line.key}`}
              onClick={onSelectLine ? () => onSelectLine(line.id) : undefined}
              dataKey={line.key}
              name={line.name}
              type="linear"
              stroke={line.color}
              fill={line.color}
              strokeWidth={
                settings.seriesStyles[line.id]?.width ?? settings.lineWidth
              }
              fillOpacity={settings.chartType === "percent-area" ? 0.65 : 0.12}
              stackId={
                settings.chartType === "percent-area" ? "percentage" : undefined
              }
              dot={settings.showPoints ? { r: 2 } : false}
              activeDot={{
                r: 3,
                opacity: lineOpacity(line),
                pointerEvents: selectedRunIds ? "none" : undefined,
              }}
              isAnimationActive={false}
              connectNulls={settings.connectMissing}
            />
          ),
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
});

const Preview = memo(function Preview({
  settings,
  series,
  histories,
  smoothing,
}: {
  settings: ChartSettings;
  series: Series[];
  histories: Record<string, MetricPoint[]>;
  smoothing: number;
}) {
  const plot = useMemo(
    () => buildChartData(series, histories, settings, smoothing),
    [series, histories, settings, smoothing],
  );
  const data = useMemo(
    () =>
      settings.chartType === "percent-area"
        ? percentageData(plot.data, plot.lines)
        : plot.data,
    [plot, settings.chartType],
  );
  const domain = {
    x:
      configuredRange(
        settings.xMin,
        settings.xMax,
        settings.xScale,
        dataRange(data, plot.lines, "x", settings.xScale === "log"),
      ).range ?? dataRange(data, plot.lines, "x", settings.xScale === "log"),
    y:
      settings.chartType === "percent-area"
        ? ([0, 100] as AxisRange)
        : (configuredRange(
            settings.yMin,
            settings.yMax,
            settings.yScale,
            dataRange(
              data,
              plot.lines,
              "y",
              settings.yScale === "log",
              settings.ignoreOutliers,
            ),
          ).range ??
          dataRange(
            data,
            plot.lines,
            "y",
            settings.yScale === "log",
            settings.ignoreOutliers,
          )),
  };
  return (
    <div className="chart-preview-layout">
      <h3>
        {settings.title ||
          [
            ...settings.metrics,
            ...settings.expressions.map((value) => value.name || value.formula),
          ].join(", ")}
      </h3>
      {settings.legend !== "none" && (
        <div className="chart-preview-legend">
          {plot.lines.map((line) => (
            <span key={line.id} style={{ color: line.color }}>
              <i style={{ background: line.color }} />
              {legendLabel(line, settings)}
            </span>
          ))}
        </div>
      )}
      <div className="chart-preview-canvas">
        <PlotCanvas
          data={data}
          lines={plot.lines}
          settings={settings}
          domain={domain}
        />
      </div>
    </div>
  );
});

const xml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function MetricChart({
  metric,
  series,
  histories,
  metrics = EMPTY_METRICS,
  loading = false,
  smoothing,
  onRemoveMetric,
  scope = "workspace",
  focused = false,
  suppressed = false,
  onFocusMetric,
  defaultSpan = 6,
  onMovePanel,
  uniformLayout,
  onUniformLayoutChange,
  sharedSize,
  onSharedSizeChange,
  sharedSelection,
  onSelectRuns,
  selectedRunIds,
}: {
  metric: string;
  series: Series[];
  histories: Record<string, MetricPoint[]>;
  metrics?: MetricDefinition[];
  loading?: boolean;
  smoothing: number;
  onRemoveMetric: (metric: string) => void;
  scope?: string;
  focused?: boolean;
  suppressed?: boolean;
  onFocusMetric?: (metric: string | null) => void;
  defaultSpan?: number;
  onMovePanel?: (source: string, target: string) => void;
  uniformLayout?: UniformPanelLayout;
  onUniformLayoutChange?: (
    layout: UniformPanelLayout | null,
    commit: boolean,
  ) => void;
  sharedSize?: { width: number; height: number };
  onSharedSizeChange?: (
    size: { width: number; height: number } | null,
    commit: boolean,
  ) => void;
  sharedSelection?: { metrics: string[]; xAxis: string };
  onSelectRuns?: (ids: string[]) => void;
  selectedRunIds?: string[];
}) {
  const sharedLayout = onUniformLayoutChange ? uniformLayout : undefined;
  const sharedSizing = !!sharedLayout || !!sharedSize;
  const [settings, setSettings] = useState(() => defaultChartSettings(metric));
  const [editor, setEditor] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [mode, setMode] = useState<"inspect" | "zoom" | "pan">("zoom");
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [notice, setNotice] = useState("");
  const [panelLayout, setPanelLayout] = useState<PanelLayout | null>(null);
  const [resizing, setResizing] = useState(false);
  const [dropTarget, setDropTarget] = useState(false);
  const [layoutAnnouncement, setLayoutAnnouncement] = useState("");
  const card = useRef<HTMLElement>(null);
  const plotElement = useRef<HTMLDivElement>(null);
  const selectionBox = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    domain: Viewport;
    width: number;
    height: number;
    runIds?: string[];
  } | null>(null);
  const selectionFrame = useRef<number | null>(null);
  const resizeFrame = useRef<number | null>(null);
  const resizeDrag = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    gridWidth: number;
    gap: number;
    narrow: boolean;
    previous: PanelLayout | null;
    next: PanelLayout;
    columns: number;
    previousUniform?: UniformPanelLayout;
    nextUniform?: UniformPanelLayout;
    previousSharedSize?: { width: number; height: number };
    originalSharedSize?: { width: number; height: number };
    nextSharedSize?: { width: number; height: number };
  } | null>(null);
  const storageKey = `local-chart-v2:${scope}:${metric}`;
  const layoutKey = `local-chart-layout-v1:${scope}:${metric}`;
  const selectedMetricKeys = sharedSelection?.metrics.join("\u0000") ?? "";
  const selectedXAxis = sharedSelection?.xAxis;
  useEffect(() => {
    try {
      const restored = restoreChartSettings(
        metric,
        JSON.parse(localStorage.getItem(storageKey) || "null"),
      );
      // Browser preferences are restored after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettings(restored);
    } catch {
      /* Default settings also work when storage is unavailable. */
    }
  }, [metric, storageKey]);
  useEffect(() => {
    if (!selectedXAxis || !selectedMetricKeys) return;
    const metrics = selectedMetricKeys.split("\u0000");
    // The Ablations toolbar applies the same plot selection to every cell.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSettings((previous) => {
      const axisChanged = previous.xAxis !== selectedXAxis;
      const metricsChanged =
        previous.metrics.length !== metrics.length ||
        previous.metrics.some((key, index) => key !== metrics[index]);
      if (!axisChanged && !metricsChanged && !previous.xExpression)
        return previous;
      return {
        ...previous,
        title: "",
        metrics,
        xAxis: selectedXAxis,
        xFormat: selectedXAxis === "runtime" ? "duration" : "number",
        xScale: axisChanged ? "linear" : previous.xScale,
        xExpression: "",
        xLabel: "",
        xMin: axisChanged ? "" : previous.xMin,
        xMax: axisChanged ? "" : previous.xMax,
        yMin: metricsChanged ? "" : previous.yMin,
        yMax: metricsChanged ? "" : previous.yMax,
      };
    });
    setViewport(null);
    setHidden([]);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedMetricKeys, selectedXAxis]);
  useEffect(() => {
    if (sharedSizing) return;
    try {
      // Restore browser-only panel geometry after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPanelLayout(
        restorePanelLayout(
          JSON.parse(localStorage.getItem(layoutKey) || "null"),
        ),
      );
    } catch {
      /* Default grid dimensions remain usable without storage. */
    }
  }, [layoutKey, sharedSizing]);
  useEffect(
    () => () => {
      if (selectionFrame.current !== null)
        cancelAnimationFrame(selectionFrame.current);
      if (resizeFrame.current !== null)
        cancelAnimationFrame(resizeFrame.current);
    },
    [],
  );
  useEffect(() => {
    if (!expanded) return;
    const previous = document.activeElement as HTMLElement | null;
    card.current?.focus();
    return () => previous?.focus();
  }, [expanded]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: globalThis.PointerEvent) => {
      if (!card.current?.contains(event.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);
  const availableMetrics = useMemo(
    () =>
      metrics.length
        ? metrics
        : [
            ...new Set([
              metric,
              ...Object.values(histories).flatMap((history) =>
                Object.keys(history[0]?.values ?? {}),
              ),
            ]),
          ].map((key) => ({ key, label: key })),
    [metrics, metric, histories],
  );
  const plot = useMemo(
    () => buildChartData(series, histories, settings, smoothing),
    [series, histories, settings, smoothing],
  );
  const visibleLines = useMemo(() => {
    const hiddenIds = new Set(hidden);
    return plot.lines.filter((line) => !hiddenIds.has(line.id));
  }, [plot.lines, hidden]);
  const data = useMemo(
    () =>
      settings.chartType === "percent-area"
        ? percentageData(plot.data, visibleLines)
        : plot.data,
    [plot.data, visibleLines, settings.chartType],
  );
  const autoDomain = useMemo<Viewport>(
    () => ({
      x:
        configuredRange(
          settings.xMin,
          settings.xMax,
          settings.xScale,
          dataRange(data, visibleLines, "x", settings.xScale === "log"),
        ).range ??
        dataRange(data, visibleLines, "x", settings.xScale === "log"),
      y:
        settings.chartType === "percent-area"
          ? [0, 100]
          : (configuredRange(
              settings.yMin,
              settings.yMax,
              settings.yScale,
              dataRange(
                data,
                visibleLines,
                "y",
                settings.yScale === "log",
                settings.ignoreOutliers,
              ),
            ).range ??
            dataRange(
              data,
              visibleLines,
              "y",
              settings.yScale === "log",
              settings.ignoreOutliers,
            )),
    }),
    [data, visibleLines, settings],
  );
  const domain = viewport ?? autoDomain;
  useEffect(() => {
    const element = plotElement.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      const x = Math.max(
        0,
        Math.min(
          1,
          (event.clientX - bounds.left - MARGIN.left - Y_WIDTH) /
            (bounds.width - MARGIN.left - Y_WIDTH - MARGIN.right),
        ),
      );
      const y = Math.max(
        0,
        Math.min(
          1,
          1 -
            (event.clientY - bounds.top - MARGIN.top) /
              (bounds.height - MARGIN.top - MARGIN.bottom - X_HEIGHT),
        ),
      );
      const factor = Math.exp(Math.max(-1, Math.min(1, event.deltaY * 0.002)));
      setViewport({
        x: zoomRange(domain.x, factor, x, settings.xScale === "log"),
        y: zoomRange(domain.y, factor, y, settings.yScale === "log"),
      });
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [domain, settings.xScale, settings.yScale, expanded, suppressed]);
  const percentInvalid =
    settings.chartType === "percent-area" &&
    plot.data.some((row) =>
      visibleLines.some(
        (line) =>
          typeof row[line.key] === "number" && (row[line.key] as number) < 0,
      ),
    );
  const hasValues = data.some((row) =>
    visibleLines.some((line) => typeof row[line.key] === "number"),
  );
  const title =
    settings.title ||
    [
      ...settings.metrics,
      ...settings.expressions.map((value) => value.name || value.formula),
    ].join(", ") ||
    metric;
  const resetZoom = () => {
    setViewport(null);
    if (selectionBox.current) selectionBox.current.style.display = "none";
    drag.current = null;
  };
  const changeZoom = (factor: number) =>
    setViewport({
      x: zoomRange(domain.x, factor, 0.5, settings.xScale === "log"),
      y: zoomRange(domain.y, factor, 0.5, settings.yScale === "log"),
    });
  const move = (direction: number) => {
    const [low, high] =
      settings.xScale === "log" ? domain.x.map(Math.log) : domain.x;
    const shift = (high - low) * direction * 0.2;
    const next: AxisRange = [low + shift, high + shift];
    setViewport({
      x: settings.xScale === "log" ? (next.map(Math.exp) as AxisRange) : next,
      y: domain.y,
    });
  };
  const pointerPosition = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const width = bounds.width - MARGIN.left - Y_WIDTH - MARGIN.right;
    const height = bounds.height - MARGIN.top - MARGIN.bottom - X_HEIGHT;
    return {
      x: (event.clientX - bounds.left - MARGIN.left - Y_WIDTH) / width,
      y: 1 - (event.clientY - bounds.top - MARGIN.top) / height,
      width,
      height,
    };
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      mode === "inspect" ||
      event.button !== 0 ||
      loading ||
      !visibleLines.length
    )
      return;
    const point = pointerPosition(event);
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
    const curve = (event.target as Element).closest(".plot-series");
    drag.current = {
      start: point,
      end: point,
      domain,
      width: point.width,
      height: point.height,
      runIds: onSelectRuns
        ? visibleLines.find((line) =>
            curve?.classList.contains(`plot-series-${line.key}`),
          )?.runIds
        : undefined,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const point = pointerPosition(event);
    current.end = {
      x: Math.max(0, Math.min(1, point.x)),
      y: Math.max(0, Math.min(1, point.y)),
    };
    if (selectionFrame.current !== null) return;
    selectionFrame.current = requestAnimationFrame(() => {
      selectionFrame.current = null;
      if (drag.current !== current) return;
      if (mode === "pan") {
        setViewport({
          x: panRange(
            current.domain.x,
            current.start.x - current.end.x,
            settings.xScale === "log",
          ),
          y: panRange(
            current.domain.y,
            current.start.y - current.end.y,
            settings.yScale === "log",
          ),
        });
      } else if (selectionBox.current) {
        // Move the selection overlay without rerendering chart geometry on every pointer move.
        Object.assign(selectionBox.current.style, {
          display: "block",
          left: `${MARGIN.left + Y_WIDTH + Math.min(current.start.x, current.end.x) * current.width}px`,
          top: `${MARGIN.top + (1 - Math.max(current.start.y, current.end.y)) * current.height}px`,
          width: `${Math.abs(current.start.x - current.end.x) * current.width}px`,
          height: `${Math.abs(current.start.y - current.end.y) * current.height}px`,
        });
      }
    });
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const position = pointerPosition(event);
    const end = {
      x: Math.max(0, Math.min(1, position.x)),
      y: Math.max(0, Math.min(1, position.y)),
    };
    if (
      onSelectRuns &&
      current.runIds &&
      Math.abs(end.x - current.start.x) * current.width <= 8 &&
      Math.abs(end.y - current.start.y) * current.height <= 8
    ) {
      onSelectRuns(current.runIds);
    }
    if (mode === "zoom") {
      const xChanged = Math.abs(end.x - current.start.x) * current.width > 8;
      const yChanged = Math.abs(end.y - current.start.y) * current.height > 8;
      if (xChanged || yChanged)
        setViewport({
          x: xChanged
            ? selectedRange(
                current.start.x,
                end.x,
                current.domain.x,
                settings.xScale === "log",
              )
            : current.domain.x,
          y: yChanged
            ? selectedRange(
                current.start.y,
                end.y,
                current.domain.y,
                settings.yScale === "log",
              )
            : current.domain.y,
        });
    } else
      setViewport({
        x: panRange(
          current.domain.x,
          current.start.x - end.x,
          settings.xScale === "log",
        ),
        y: panRange(
          current.domain.y,
          current.start.y - end.y,
          settings.yScale === "log",
        ),
      });
    drag.current = null;
    if (selectionBox.current) selectionBox.current.style.display = "none";
  };
  const highlightSeries = useCallback((key: string | null) => {
    card.current
      ?.querySelectorAll<SVGElement>(".plot-series")
      .forEach((element) => {
        if (!key) {
          element.style.removeProperty("opacity");
          return;
        }
        element.style.opacity = element.classList.contains(`plot-series-${key}`)
          ? "1"
          : "0.13";
      });
  }, []);
  const selectLine = (id: string) => {
    const line = plot.lines.find((line) => line.id === id);
    if (onSelectRuns && line) {
      onSelectRuns(line.runIds);
      return;
    }
    setHidden((previous) => {
      if (plot.lines.every((line) => !previous.includes(line.id)))
        return plot.lines
          .filter((line) => line.id !== id)
          .map((line) => line.id);
      return previous.includes(id)
        ? previous.filter((key) => key !== id)
        : [...previous, id];
    });
  };
  const applySettings = (next: ChartSettings) => {
    const applied =
      next.chartType === "percent-area"
        ? { ...next, yScale: "linear" as const }
        : next;
    setSettings(applied);
    setEditor(false);
    resetZoom();
    setHidden([]);
    if (applied.tooltip === "click") setMode("inspect");
    try {
      localStorage.setItem(storageKey, JSON.stringify(applied));
    } catch {
      /* Settings remain available for this session. */
    }
  };
  const exportCsv = () => {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const headers = [
      xLabel(settings),
      ...visibleLines.map((line) => legendLabel(line, settings)),
    ].map((value) => quote(/^[=+@\-]/.test(value) ? `'${value}` : value));
    const rows = data
      .filter((row) => row.x >= domain.x[0] && row.x <= domain.x[1])
      .map((row) =>
        [row.x, ...visibleLines.map((line) => row[line.key] ?? "")].join(","),
      );
    downloadBlob(
      new Blob([[headers.join(","), ...rows].join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
      `${metric.replaceAll("/", "-")}.csv`,
    );
    setMenu(false);
    setNotice("CSV downloaded.");
  };
  const exportImage = async (format: "svg" | "png") => {
    try {
      const svg = plotElement.current?.querySelector<SVGSVGElement>(
        "svg.recharts-surface",
      );
      if (!svg) throw new Error("Wait for the chart to finish loading.");
      const bounds = svg.getBoundingClientRect();
      const width = Math.ceil(bounds.width),
        chartHeight = Math.ceil(bounds.height);
      const header = 46 + Math.ceil(visibleLines.length / 2) * 20;
      const height = chartHeight + header;
      const legend = visibleLines
        .map(
          (line, index) =>
            `<g transform="translate(${16 + ((index % 2) * width) / 2},${45 + Math.floor(index / 2) * 20})"><line x2="14" stroke="${xml(line.color)}" stroke-width="2"/><text x="20" y="4" font-size="12">${xml(legendLabel(line, settings))}</text></g>`,
        )
        .join("");
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("x", "0");
      clone.setAttribute("y", String(header));
      clone.style.width = `${width}px`;
      clone.style.height = `${chartHeight}px`;
      const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial, sans-serif" fill="#30363d"><text x="16" y="24" font-size="16" font-weight="600">${xml(title)}</text>${legend}${new XMLSerializer().serializeToString(clone)}</g></svg>`;
      const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
      if (format === "svg")
        downloadBlob(blob, `${metric.replaceAll("/", "-")}.svg`);
      else {
        const url = URL.createObjectURL(blob);
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = width * 2;
          canvas.height = height * 2;
          const context = canvas.getContext("2d");
          if (!context)
            throw new Error("Image export is unavailable in this browser.");
          context.scale(2, 2);
          context.drawImage(img, 0, 0);
          const png = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (value) =>
                value
                  ? resolve(value)
                  : reject(new Error("Unable to create PNG.")),
              "image/png",
            ),
          );
          downloadBlob(png, `${metric.replaceAll("/", "-")}.png`);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      setNotice(`${format.toUpperCase()} downloaded.`);
      setMenu(false);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to export chart.",
      );
    }
  };
  const legend = settings.legend !== "none" && (
    <div
      className={`chart-legend chart-legend-${settings.legend}`}
      aria-label={`Series for ${metric}`}
      style={{
        fontSize:
          settings.fontSize === "large"
            ? 16
            : settings.fontSize === "medium"
              ? 14
              : 13,
      }}
    >
      {plot.lines.map((line) => {
        const isHidden = selectedRunIds
          ? !line.runIds.some((id) => selectedRunIds.includes(id))
          : hidden.includes(line.id);
        const action = onSelectRuns
          ? "Toggle trial selection"
          : visibleLines.length === plot.lines.length
            ? "Show only this series"
            : isHidden
              ? "Show this series alongside the others"
              : "Hide this series";
        return (
          <button
            key={line.id}
            title={`${line.name} · ${action}`}
            aria-label={`${action}: ${line.name}`}
            aria-pressed={!isHidden}
            className={isHidden ? "series-hidden" : ""}
            onClick={() => selectLine(line.id)}
            onMouseEnter={() => highlightSeries(line.key)}
            onMouseLeave={() => highlightSeries(null)}
            onFocus={() => highlightSeries(line.key)}
            onBlur={() => highlightSeries(null)}
            style={{ color: line.color }}
          >
            <span style={{ background: line.color }} />
            <span className="chart-legend-name">
              {legendLabel(line, settings)}
            </span>
            {settings.legendValue !== "none" && (
              <b>{compact(line[settings.legendValue] ?? NaN)}</b>
            )}
          </button>
        );
      })}
    </div>
  );
  const toggleExpand = () => {
    if (onFocusMetric) onFocusMetric(focused ? null : metric);
    else setExpanded((value) => !value);
  };
  const commitLayout = (layout: PanelLayout | null) => {
    setPanelLayout(layout);
    try {
      if (layout) localStorage.setItem(layoutKey, JSON.stringify(layout));
      else localStorage.removeItem(layoutKey);
    } catch {
      /* Resizing also works without persistent storage. */
    }
    setLayoutAnnouncement(
      layout
        ? `Panel width ${layout.span} of ${PANEL_GRID_UNITS}, height ${layout.height} pixels.`
        : "Default panel size restored.",
    );
  };
  const commitUniformLayout = (layout: UniformPanelLayout | null) => {
    onUniformLayoutChange?.(layout, true);
    setLayoutAnnouncement(
      layout
        ? `All charts: up to ${layout.columns} per row, height ${layout.height} pixels.`
        : "Default size restored for all charts.",
    );
  };
  const commitSharedSize = (size: { width: number; height: number } | null) => {
    onSharedSizeChange?.(size, true);
    setLayoutAnnouncement(
      size
        ? `All charts: width ${size.width} pixels, height ${size.height} pixels.`
        : "Default size restored for all charts.",
    );
  };
  const resetPanelSize = () => {
    if (sharedSize) commitSharedSize(null);
    else if (sharedLayout) commitUniformLayout(null);
    else commitLayout(null);
  };
  const getResizeStart = () => {
    const element = card.current;
    if (!element) return null;
    const bounds = element.getBoundingClientRect();
    const grid = element.parentElement;
    return {
      width: bounds.width,
      height: bounds.height,
      gridWidth: grid?.getBoundingClientRect().width ?? bounds.width,
      gap: grid ? parseFloat(getComputedStyle(grid).columnGap) || 0 : 0,
      narrow: window.matchMedia("(max-width: 720px)").matches,
      columns:
        sharedLayout?.columns ?? Math.round(PANEL_GRID_UNITS / defaultSpan),
    };
  };
  const startResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const start = getResizeStart();
    if (!start) return;
    event.preventDefault();
    event.stopPropagation();
    resizeDrag.current = {
      ...start,
      x: event.clientX,
      y: event.clientY,
      previous: panelLayout,
      previousUniform: sharedLayout,
      previousSharedSize: sharedSize
        ? { width: start.width, height: start.height }
        : undefined,
      originalSharedSize: sharedSize,
      nextUniform: sharedLayout
        ? resizedUniformPanelLayout(
            start,
            { x: 0, y: 0 },
            start.gridWidth,
            start.gap,
            start.narrow,
          )
        : undefined,
      next: resizedPanelLayout(
        start,
        { x: 0, y: 0 },
        start.gridWidth,
        start.gap,
        start.narrow,
      ),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
    if (sharedLayout) onUniformLayoutChange?.(sharedLayout, false);
  };
  const moveResize = (event: PointerEvent<HTMLButtonElement>) => {
    const current = resizeDrag.current;
    if (!current) return;
    current.next = resizedPanelLayout(
      current,
      { x: event.clientX - current.x, y: event.clientY - current.y },
      current.gridWidth,
      current.gap,
      current.narrow,
    );
    if (sharedLayout)
      current.nextUniform = resizedUniformPanelLayout(
        current,
        { x: event.clientX - current.x, y: event.clientY - current.y },
        current.gridWidth,
        current.gap,
        current.narrow,
      );
    if (sharedSize && current.previousSharedSize) {
      current.nextSharedSize = {
        width: Math.round(
          Math.max(
            320,
            Math.min(
              1200,
              current.previousSharedSize.width + event.clientX - current.x,
            ),
          ),
        ),
        height: Math.round(
          Math.max(
            MIN_PANEL_HEIGHT,
            Math.min(
              MAX_PANEL_HEIGHT,
              current.previousSharedSize.height + event.clientY - current.y,
            ),
          ),
        ),
      };
    }
    if (resizeFrame.current !== null) return;
    resizeFrame.current = requestAnimationFrame(() => {
      resizeFrame.current = null;
      if (resizeDrag.current !== current) return;
      if (sharedSize && current.nextSharedSize) {
        onSharedSizeChange?.(current.nextSharedSize, false);
      } else if (sharedLayout && current.nextUniform)
        onUniformLayoutChange?.(current.nextUniform, false);
      else setPanelLayout(current.next);
    });
  };
  const endResize = (
    event: PointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) => {
    const current = resizeDrag.current;
    if (!current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    resizeDrag.current = null;
    setResizing(false);
    if (sharedSize && current.previousSharedSize) {
      commitSharedSize(
        cancelled
          ? (current.originalSharedSize ?? null)
          : {
              width: Math.round(
                Math.max(
                  320,
                  Math.min(
                    1200,
                    current.previousSharedSize.width +
                      event.clientX -
                      current.x,
                  ),
                ),
              ),
              height: Math.round(
                Math.max(
                  MIN_PANEL_HEIGHT,
                  Math.min(
                    MAX_PANEL_HEIGHT,
                    current.previousSharedSize.height +
                      event.clientY -
                      current.y,
                  ),
                ),
              ),
            },
      );
    } else if (sharedLayout) {
      commitUniformLayout(
        cancelled
          ? (current.previousUniform ?? null)
          : resizedUniformPanelLayout(
              current,
              { x: event.clientX - current.x, y: event.clientY - current.y },
              current.gridWidth,
              current.gap,
              current.narrow,
            ),
      );
    } else if (cancelled) setPanelLayout(current.previous);
    else
      commitLayout(
        resizedPanelLayout(
          current,
          { x: event.clientX - current.x, y: event.clientY - current.y },
          current.gridWidth,
          current.gap,
          current.narrow,
        ),
      );
  };
  if (suppressed) return null;
  const content = (
    <article
      ref={card}
      className={`chart-card chart-card-interactive ${focused ? "chart-focused" : ""} ${expanded ? "chart-expanded" : ""} ${(sharedSize || sharedLayout || panelLayout) && !focused && !expanded ? "chart-size-custom" : ""} ${resizing ? "chart-panel-resizing" : ""} ${dropTarget ? "chart-drop-target" : ""}`}
      data-metric={metric}
      data-panel-span={sharedLayout ? 1 : (panelLayout?.span ?? defaultSpan)}
      data-panel-columns={sharedLayout?.columns}
      style={
        focused || expanded
          ? undefined
          : {
              gridColumn: `span ${sharedLayout ? 1 : (panelLayout?.span ?? defaultSpan)}`,
              height:
                sharedSize?.height ??
                sharedLayout?.height ??
                panelLayout?.height,
            }
      }
      onDragOver={(event) => {
        if (
          onMovePanel &&
          event.dataTransfer.types.includes("application/x-dashboard-panel")
        ) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
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
        const source = event.dataTransfer.getData(
          "application/x-dashboard-panel",
        );
        if (!source || !onMovePanel) return;
        event.preventDefault();
        setDropTarget(false);
        onMovePanel(source, metric);
      }}
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded || undefined}
      aria-label={expanded ? `Expanded chart ${metric}` : undefined}
      tabIndex={expanded ? -1 : undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (resizeDrag.current) {
            if (sharedLayout)
              commitUniformLayout(resizeDrag.current.previousUniform ?? null);
            else setPanelLayout(resizeDrag.current.previous);
            resizeDrag.current = null;
            setResizing(false);
          } else if (editor) setEditor(false);
          else if (menu) setMenu(false);
          else if (expanded || focused) toggleExpand();
          else resetZoom();
        }
        if (!expanded || event.key !== "Tab") return;
        const controls = [
          ...(card.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), [tabindex="0"]',
          ) ?? []),
        ].filter((element) => element.getClientRects().length);
        if (event.shiftKey && document.activeElement === controls[0]) {
          event.preventDefault();
          controls.at(-1)?.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === controls.at(-1)
        ) {
          event.preventDefault();
          controls[0]?.focus();
        }
      }}
    >
      {!focused && !expanded && onMovePanel && (
        <button
          className="chart-drag-handle"
          draggable
          aria-label={`Move ${metric} panel`}
          title="Drag panel. Use arrow keys to reorder."
          onDragStart={(event) => {
            event.dataTransfer.setData("application/x-dashboard-panel", metric);
            event.dataTransfer.effectAllowed = "move";
            if (card.current)
              event.dataTransfer.setDragImage(card.current, 20, 12);
          }}
          onDragEnd={() => setDropTarget(false)}
          onKeyDown={(event) => {
            if (
              !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                event.key,
              )
            )
              return;
            event.preventDefault();
            event.stopPropagation();
            const siblings = [
              ...(card.current?.parentElement?.querySelectorAll<HTMLElement>(
                "[data-metric]",
              ) ?? []),
            ].map((element) => element.dataset.metric!);
            const offset =
              event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
            const target = siblings[siblings.indexOf(metric) + offset];
            if (target) {
              onMovePanel(metric, target);
              setLayoutAnnouncement("Panel moved.");
            }
          }}
        >
          <GripVertical size={16} />
        </button>
      )}
      <div className="chart-actions">
        <button
          aria-label={
            focused || expanded ? "Restore chart" : `Expand ${metric}`
          }
          title={focused || expanded ? "Back to workspace" : "View full screen"}
          onClick={toggleExpand}
        >
          {focused || expanded ? <Minimize2 /> : <Maximize2 />}
        </button>
        <button
          aria-label={`Edit ${metric} panel`}
          title="Edit panel"
          onClick={() => setEditor(true)}
        >
          <Settings />
        </button>
        <button
          aria-label={`Options for ${metric}`}
          title="More panel actions"
          aria-expanded={menu}
          onClick={() => setMenu((value) => !value)}
        >
          <MoreHorizontal />
        </button>
      </div>
      {menu && (
        <div
          className="popover chart-menu"
          role="menu"
          aria-label={`Actions for ${metric}`}
        >
          <button
            role="menuitem"
            onClick={() => {
              setEditor(true);
              setMenu(false);
            }}
          >
            <Settings size={16} />
            Edit panel
          </button>
          <button
            role="menuitem"
            onClick={() => {
              resetZoom();
              setHidden([]);
              setMenu(false);
            }}
          >
            <RotateCcw size={16} />
            Reset chart view
          </button>
          <button role="menuitem" onClick={exportCsv}>
            <Download size={16} />
            Download CSV
          </button>
          <button role="menuitem" onClick={() => void exportImage("svg")}>
            <Download size={16} />
            Download SVG
          </button>
          <button role="menuitem" onClick={() => void exportImage("png")}>
            <Download size={16} />
            Download PNG
          </button>
          <button
            role="menuitem"
            onClick={() => {
              onRemoveMetric(metric);
              setMenu(false);
            }}
          >
            <X size={16} />
            Remove panel
          </button>
        </div>
      )}
      <h3 title={title}>
        <button className="chart-title-button" onClick={() => setEditor(true)}>
          {title}
        </button>
      </h3>
      <div
        className="chart-interaction-toolbar"
        aria-label={`Plot controls for ${metric}`}
      >
        <button
          aria-label={`Inspect ${metric}`}
          title="Inspect values"
          aria-pressed={mode === "inspect"}
          onClick={() => setMode("inspect")}
        >
          <MousePointer2 />
        </button>
        <button
          aria-label={`Select zoom ${metric}`}
          title="Drag a rectangle to zoom"
          aria-pressed={mode === "zoom"}
          onClick={() => setMode("zoom")}
        >
          <ZoomIn />
        </button>
        <button
          aria-label={`Pan ${metric}`}
          title="Drag to pan"
          aria-pressed={mode === "pan"}
          onClick={() => setMode("pan")}
        >
          <Hand />
        </button>
        <span className="chart-toolbar-separator" />
        <button
          aria-label={`Zoom in ${metric}`}
          title="Zoom in (+)"
          onClick={() => changeZoom(0.65)}
        >
          <ZoomIn />
        </button>
        <button
          aria-label={`Zoom out ${metric}`}
          title="Zoom out (−)"
          onClick={() => changeZoom(1 / 0.65)}
        >
          <ZoomOut />
        </button>
        <button
          aria-label={`Pan left ${metric}`}
          title="Pan left"
          onClick={() => move(-1)}
        >
          <ArrowLeft />
        </button>
        <button
          aria-label={`Pan right ${metric}`}
          title="Pan right"
          onClick={() => move(1)}
        >
          <ArrowRight />
        </button>
        <button
          aria-label={`Reset zoom ${metric}`}
          title="Reset axes (0 or double-click)"
          disabled={!viewport}
          onClick={resetZoom}
        >
          <RotateCcw />
        </button>
        {(!!hidden.length ||
          (selectedRunIds &&
            series.some((group) =>
              group.runs.some((run) => !selectedRunIds.includes(run.id)),
            ))) && (
          <button
            className="show-all-series"
            onClick={() => {
              setHidden([]);
              onSelectRuns?.([
                ...new Set(
                  series.flatMap((group) => group.runs.map((run) => run.id)),
                ),
              ]);
            }}
          >
            Show all
          </button>
        )}
      </div>
      <div className={`chart-content chart-content-${settings.legend}`}>
        {(settings.legend === "top" || settings.legend === "left") && legend}
        <div
          className={`chart-plot chart-mode-${mode}`}
          ref={plotElement}
          role="group"
          aria-label={`Interactive plot ${metric}`}
          title="Drag to zoom or pan. Ctrl + scroll zooms around the pointer. Double-click resets the axes."
          tabIndex={0}
          data-zoomed={!!viewport}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={() => {
            drag.current = null;
            if (selectionBox.current)
              selectionBox.current.style.display = "none";
          }}
          onDoubleClick={resetZoom}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (
              ["+", "=", "-", "0", "ArrowLeft", "ArrowRight"].includes(
                event.key,
              )
            )
              event.preventDefault();
            if (event.key === "+" || event.key === "=") changeZoom(0.65);
            else if (event.key === "-") changeZoom(1 / 0.65);
            else if (event.key === "0") resetZoom();
            else if (event.key === "ArrowLeft") move(-1);
            else if (event.key === "ArrowRight") move(1);
          }}
        >
          {loading ? (
            <div className="empty-state">Loading chart…</div>
          ) : !plot.lines.length ? (
            <div className="empty-state">
              No visible runs contain the selected metrics.
            </div>
          ) : !visibleLines.length ? (
            <div className="empty-state">
              All curves are hidden.
              <button onClick={() => setHidden([])}>Show all curves</button>
            </div>
          ) : percentInvalid ? (
            <div className="empty-state">
              Percent area plots require non-negative values. Choose a line or
              area plot.
            </div>
          ) : !hasValues ? (
            <div className="empty-state">
              No values can be plotted on these axes. Logarithmic scales require
              positive values.
            </div>
          ) : (
            <PlotCanvas
              data={data}
              lines={visibleLines}
              settings={settings}
              domain={domain}
              selectedRunIds={selectedRunIds}
              onSelectLine={
                onSelectRuns && mode === "inspect" ? selectLine : undefined
              }
            />
          )}
          <div
            ref={selectionBox}
            className="chart-selection-box"
            aria-hidden="true"
          />
        </div>
        {(settings.legend === "bottom" || settings.legend === "right") &&
          legend}
      </div>
      <div
        className={`chart-footnote ${viewport || notice ? "chart-footnote-active" : ""}`}
      >
        <span>
          {viewport
            ? `X: ${xText(domain.x[0], settings)} – ${xText(domain.x[1], settings)} · Y: ${compact(domain.y[0])} – ${compact(domain.y[1])}`
            : `${visibleLines.length} curves · ${settings.groupRuns ? settings.aggregate : "individual runs"}${settings.band !== "none" && settings.groupRuns ? ` · ${settings.band === "range" ? "min/max" : settings.band === "stddev" ? "std dev" : "std err"}` : ""}`}
        </span>
        <span role="status">{notice}</span>
      </div>
      {editor && (
        <ChartSettingsEditor
          metric={metric}
          settings={settings}
          metrics={availableMetrics}
          legendSeries={plot.lines}
          globalSmoothing={smoothing}
          onApply={applySettings}
          onClose={() => setEditor(false)}
          onDelete={() => {
            setEditor(false);
            onRemoveMetric(metric);
          }}
          preview={(draft) => (
            <Preview
              settings={draft}
              series={series}
              histories={histories}
              smoothing={smoothing}
            />
          )}
        />
      )}
      {!focused && !expanded && (
        <button
          className="chart-resize-handle"
          aria-label={`Resize ${metric} panel`}
          title={
            sharedSize || sharedLayout
              ? "Drag to resize all charts. Arrow keys adjust size; double-click or Home restores the default for all charts."
              : "Drag to resize. Arrow keys adjust size; double-click or Home restores the default."
          }
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={(event) => endResize(event)}
          onPointerCancel={(event) => endResize(event, true)}
          onDoubleClick={resetPanelSize}
          onKeyDown={(event) => {
            if (event.key === "Home") {
              event.preventDefault();
              event.stopPropagation();
              resetPanelSize();
              return;
            }
            if (
              !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                event.key,
              )
            )
              return;
            const start = getResizeStart();
            if (!start) return;
            event.preventDefault();
            event.stopPropagation();
            if (sharedSize) {
              commitSharedSize({
                width: Math.round(
                  Math.max(
                    320,
                    Math.min(
                      1200,
                      start.width +
                        (event.key === "ArrowRight"
                          ? 24
                          : event.key === "ArrowLeft"
                            ? -24
                            : 0),
                    ),
                  ),
                ),
                height: Math.round(
                  Math.max(
                    MIN_PANEL_HEIGHT,
                    Math.min(
                      MAX_PANEL_HEIGHT,
                      sharedSize.height +
                        (event.key === "ArrowDown"
                          ? 24
                          : event.key === "ArrowUp"
                            ? -24
                            : 0),
                    ),
                  ),
                ),
              });
              return;
            }
            if (sharedLayout) {
              const maximum = Math.max(
                1,
                Math.min(
                  MAX_PANEL_COLUMNS,
                  Math.floor((start.gridWidth + start.gap) / (240 + start.gap)),
                ),
              );
              commitUniformLayout({
                columns:
                  start.narrow ||
                  event.key === "ArrowUp" ||
                  event.key === "ArrowDown"
                    ? sharedLayout.columns
                    : Math.max(
                        1,
                        Math.min(
                          maximum,
                          Math.min(maximum, sharedLayout.columns) +
                            (event.key === "ArrowLeft" ? 1 : -1),
                        ),
                      ),
                height: Math.max(
                  MIN_PANEL_HEIGHT,
                  Math.min(
                    MAX_PANEL_HEIGHT,
                    sharedLayout.height +
                      (event.key === "ArrowDown"
                        ? 24
                        : event.key === "ArrowUp"
                          ? -24
                          : 0),
                  ),
                ),
              });
              return;
            }
            const unit = (start.gridWidth + start.gap) / PANEL_GRID_UNITS;
            commitLayout(
              resizedPanelLayout(
                start,
                {
                  x:
                    event.key === "ArrowRight"
                      ? unit
                      : event.key === "ArrowLeft"
                        ? -unit
                        : 0,
                  y:
                    event.key === "ArrowDown"
                      ? 24
                      : event.key === "ArrowUp"
                        ? -24
                        : 0,
                },
                start.gridWidth,
                start.gap,
                start.narrow,
              ),
            );
          }}
        />
      )}
      <span className="chart-layout-announcement" role="status">
        {layoutAnnouncement}
      </span>
    </article>
  );
  return expanded
    ? createPortal(
        <div className="chart-fullscreen-backdrop">{content}</div>,
        document.body,
      )
    : content;
}

export default memo(MetricChart);
