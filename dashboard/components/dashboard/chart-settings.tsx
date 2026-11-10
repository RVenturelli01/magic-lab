"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ChartArea,
  ChartLine,
  Layers,
  List,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import {
  configuredRange,
  defaultChartSettings,
  type ChartSettings,
  type PlotSeries,
} from "@/lib/data/chart-model";
import { expressionError } from "@/lib/data/chart-expression";
import type { MetricDefinition } from "@/lib/data";

export default function ChartSettingsEditor({
  metric,
  settings,
  metrics,
  legendSeries,
  globalSmoothing,
  preview,
  onApply,
  onDelete,
  onClose,
}: {
  metric: string;
  settings: ChartSettings;
  metrics: MetricDefinition[];
  legendSeries: PlotSeries[];
  globalSmoothing: number;
  preview: (settings: ChartSettings) => ReactNode;
  onApply: (settings: ChartSettings) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [tab, setTab] = useState("Data");
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId(),
    tabsId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    [...(dialog.current?.querySelectorAll<HTMLElement>("button") ?? [])]
      .find((element) => element.getClientRects().length)
      ?.focus();
    return () => previous?.focus();
  }, []);
  const update = <K extends keyof ChartSettings>(
    key: K,
    value: ChartSettings[K],
  ) => setDraft((previous) => ({ ...previous, [key]: value }));
  const error =
    configuredRange(draft.xMin, draft.xMax, draft.xScale).error ||
    configuredRange(draft.yMin, draft.yMax, draft.yScale).error ||
    expressionError(draft.xExpression) ||
    draft.expressions
      .map((value) =>
        !value.formula.trim()
          ? "Enter an expression or remove the empty row."
          : expressionError(value.formula),
      )
      .find(Boolean) ||
    (!draft.metrics.length && !draft.expressions.length
      ? "Select at least one metric or add an expression."
      : "");
  const previewSettings = !error ? draft : settings;
  const validPreview =
    previewSettings.chartType === "percent-area"
      ? { ...previewSettings, yScale: "linear" as const }
      : previewSettings;
  const select = <K extends keyof ChartSettings>(
    key: K,
    label: string,
    options: [string, string][],
  ) => (
    <label className="chart-setting-field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={String(draft[key])}
        onChange={(event) =>
          update(key, event.target.value as ChartSettings[K])
        }
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  const toggle = (
    key:
      | "groupRuns"
      | "showRaw"
      | "showGrid"
      | "showPoints"
      | "connectMissing"
      | "ignoreOutliers",
    label: string,
    description?: string,
  ) => (
    <label className="chart-setting-toggle">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={draft[key]}
        onChange={(event) => update(key, event.target.checked)}
      />
    </label>
  );
  const options = <K extends keyof ChartSettings>(
    key: K,
    label: string,
    values: [string, string][],
  ) => (
    <fieldset className="chart-options-row">
      <legend>{label}</legend>
      <div role="radiogroup" aria-label={label}>
        {values.map(([value, text]) => (
          <label key={value}>
            <input
              type="radio"
              name={`${tabsId}-${key}`}
              value={value}
              checked={draft[key] === value}
              onChange={() => update(key, value as ChartSettings[K])}
            />
            <span>{text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
  const axisRange = (axis: "x" | "y") => (
    <div className={`chart-axis-branch chart-axis-branch-${axis}`}>
      <span className="chart-axis-branch-title">Range</span>
      <div className="chart-axis-branch-fields">
        {axis === "x" &&
          select("xFormat", "Format", [
            ["number", "Number"],
            ["scientific", "Scientific"],
            ["duration", "Duration"],
          ])}
        <div className="chart-setting-range">
          <span>Range</span>
          <div>
            <input
              aria-label={`Min ${axis.toUpperCase()} Axis value`}
              type="number"
              step="any"
              value={draft[`${axis}Min`]}
              placeholder="min"
              onChange={(event) => update(`${axis}Min`, event.target.value)}
            />
            <input
              aria-label={`Max ${axis.toUpperCase()} Axis value`}
              type="number"
              step="any"
              value={draft[`${axis}Max`]}
              placeholder="max"
              onChange={(event) => update(`${axis}Max`, event.target.value)}
            />
            <button
              className="chart-log-toggle"
              aria-label={`Logarithmic ${axis.toUpperCase()} axis`}
              aria-pressed={draft[`${axis}Scale`] === "log"}
              title="Logarithmic scale"
              onClick={() =>
                update(
                  `${axis}Scale`,
                  draft[`${axis}Scale`] === "log" ? "linear" : "log",
                )
              }
            >
              <List size={17} />
            </button>
          </div>
        </div>
        <label className="chart-setting-field">
          <span>Label</span>
          <input
            aria-label={`${axis.toUpperCase()} axis label`}
            value={draft[`${axis}Label`]}
            placeholder={
              axis === "x"
                ? draft.xAxis === "step"
                  ? "Step"
                  : draft.xAxis === "runtime"
                    ? "Time (seconds)"
                    : "Wall time"
                : ""
            }
            onChange={(event) => update(`${axis}Label`, event.target.value)}
          />
        </label>
      </div>
    </div>
  );
  return createPortal(
    <div
      className="chart-editor-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="chart-editor"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
          if (event.key !== "Tab") return;
          const controls = [
            ...(dialog.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]',
            ) ?? []),
          ].filter((element) => element.getClientRects().length);
          const first = controls[0],
            last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <h2 id={titleId} className="chart-editor-title">
          Edit panel · {metric}
        </h2>
        <button
          className="chart-editor-close icon-button"
          aria-label="Close panel editor"
          onClick={onClose}
        >
          <X />
        </button>
        <div className="chart-editor-preview" aria-label="Panel preview">
          {preview(validPreview)}
        </div>
        <div
          className="chart-editor-tabs"
          role="tablist"
          aria-label="Panel settings"
        >
          {["Data", "Grouping", "Display preferences", "Expressions"].map(
            (name) => (
              <button
                key={name}
                id={`${tabsId}-${name}`}
                role="tab"
                aria-selected={tab === name}
                aria-controls={`${tabsId}-content`}
                tabIndex={tab === name ? 0 : -1}
                onClick={() => setTab(name)}
                onKeyDown={(event) => {
                  const names = [
                    "Data",
                    "Grouping",
                    "Display preferences",
                    "Expressions",
                  ];
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const index =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 3
                        : (names.indexOf(tab) +
                            (event.key === "ArrowRight" ? 1 : 3)) %
                          4;
                  setTab(names[index]);
                  document.getElementById(`${tabsId}-${names[index]}`)?.focus();
                }}
              >
                {name}
              </button>
            ),
          )}
        </div>
        <div
          className="chart-editor-content"
          role="tabpanel"
          id={`${tabsId}-content`}
          aria-labelledby={`${tabsId}-${tab}`}
        >
          {tab === "Data" && (
            <div className="chart-data-settings">
              <label className="chart-setting-field chart-title-setting">
                <span>Chart title</span>
                <input
                  aria-label="Chart title"
                  value={draft.title}
                  placeholder={metric}
                  onChange={(event) => update("title", event.target.value)}
                />
              </label>
              <div className="chart-x-selection">
                {select("xAxis", "X axis", [
                  ["step", "Step"],
                  ["runtime", "Time (seconds)"],
                  ["timestamp", "Wall time"],
                  ...metrics.map(
                    (value) =>
                      [`metric:${value.key}`, value.label] as [string, string],
                  ),
                ])}
                <button
                  aria-label="Reset X axis"
                  title="Reset X axis"
                  onClick={() =>
                    setDraft((previous) => ({
                      ...previous,
                      xAxis: "step",
                      xMin: "",
                      xMax: "",
                      xScale: "linear",
                      xLabel: "",
                      xExpression: "",
                    }))
                  }
                >
                  <RotateCcw size={16} />
                </button>
              </div>
              {axisRange("x")}
              <div className="chart-y-selection">
                <span>Y axis</span>
                <details className="chart-metric-select">
                  <summary aria-label="Choose Y axis metrics">
                    <div className="chart-selected-metrics">
                      {draft.metrics.length ? (
                        draft.metrics.map((key) => (
                          <span key={key}>
                            {key}
                            <button
                              aria-label={`Remove metric ${key}`}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                update(
                                  "metrics",
                                  draft.metrics.filter(
                                    (value) => value !== key,
                                  ),
                                );
                              }}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="chart-select-placeholder">
                          Select metrics
                        </span>
                      )}
                    </div>
                  </summary>
                  <div className="chart-metric-dropdown">
                    <div className="chart-metric-options">
                      {metrics.map((value) => (
                        <label key={value.key}>
                          <input
                            type="checkbox"
                            checked={draft.metrics.includes(value.key)}
                            onChange={() =>
                              update(
                                "metrics",
                                draft.metrics.includes(value.key)
                                  ? draft.metrics.filter(
                                      (key) => key !== value.key,
                                    )
                                  : [...draft.metrics, value.key],
                              )
                            }
                          />
                          {value.label}
                        </label>
                      ))}
                    </div>
                    <div className="chart-metric-select-actions">
                      <button
                        onClick={() =>
                          update("metrics", [
                            ...new Set([
                              ...draft.metrics,
                              ...metrics.map((value) => value.key),
                            ]),
                          ])
                        }
                      >
                        Select all
                      </button>
                      <button onClick={() => update("metrics", [])}>
                        Clear
                      </button>
                    </div>
                  </div>
                </details>
              </div>
              {axisRange("y")}
              <div className="chart-max-groups">
                <label htmlFor={`${tabsId}-max-groups`}>
                  Max groups to show
                </label>
                <button
                  aria-label="Reset max groups"
                  onClick={() => update("maxSeries", 0)}
                >
                  <RotateCcw size={15} />
                </button>
                <input
                  aria-label="Max groups slider"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.min(100, draft.maxSeries)}
                  onChange={(event) => update("maxSeries", +event.target.value)}
                />
                <input
                  id={`${tabsId}-max-groups`}
                  aria-label="Max groups to show"
                  type="number"
                  min={0}
                  max={1000}
                  value={draft.maxSeries}
                  title="0 shows all selected groups"
                  onChange={(event) =>
                    update(
                      "maxSeries",
                      Math.min(
                        1000,
                        Math.max(0, Math.trunc(+event.target.value)),
                      ),
                    )
                  }
                />
              </div>
              {toggle(
                "ignoreOutliers",
                "Outliers",
                "Exclude extreme outliers when scaling charts",
              )}
              <div className="chart-point-aggregation">
                <strong>Point aggregation method</strong>
                <p>Only applies to lines with more than 1,000 data points.</p>
                {options("pointAggregation", "Point aggregation method", [
                  ["sample", "Random sampling"],
                  ["full", "Full fidelity"],
                ])}
              </div>
              {toggle(
                "groupRuns",
                "Use grouping from the runs table in charts",
              )}
              {options("aggregate", "Aggregation", [
                ["mean", "Mean"],
                ["min", "Min"],
                ["max", "Max"],
              ])}
              {select("smoothingMethod", "Smoothing", [
                ["none", "No smoothing"],
                ["twema", "Time weighted EMA"],
                ["moving-average", "Running average"],
                ["gaussian", "Gaussian"],
                ["ema", "Exponential moving average"],
              ])}
              {draft.smoothingMethod !== "none" && (
                <div className="chart-smoothing-options">
                  <div className="chart-smoothing-control">
                    <input
                      aria-label="Panel smoothing strength"
                      type="range"
                      min={0}
                      max={0.99}
                      step={0.01}
                      value={draft.smoothing ?? globalSmoothing}
                      onChange={(event) =>
                        update("smoothing", +event.target.value)
                      }
                    />
                    <input
                      aria-label="Panel smoothing value"
                      type="number"
                      min={0}
                      max={0.99}
                      step={0.01}
                      value={draft.smoothing ?? globalSmoothing}
                      onChange={(event) =>
                        update(
                          "smoothing",
                          Math.min(0.99, Math.max(0, +event.target.value)),
                        )
                      }
                    />
                  </div>
                  <label className="chart-inherit-smoothing">
                    <input
                      type="checkbox"
                      checked={draft.smoothing === null}
                      onChange={(event) =>
                        update(
                          "smoothing",
                          event.target.checked ? null : globalSmoothing,
                        )
                      }
                    />
                    Use workspace smoothing
                  </label>
                  {toggle("showRaw", "Show Original")}
                </div>
              )}
              <div className="chart-type-setting">
                <span>Chart type</span>
                <div role="group" aria-label="Chart type">
                  {[
                    ["line", "Line plot", ChartLine],
                    ["area", "Area plot", ChartArea],
                    ["percent-area", "Percent area plot", Layers],
                  ].map(([value, label, Icon]) => (
                    <button
                      key={String(value)}
                      aria-label={String(label)}
                      title={String(label)}
                      aria-pressed={draft.chartType === value}
                      onClick={() =>
                        update("chartType", value as ChartSettings["chartType"])
                      }
                    >
                      {typeof Icon !== "string" && <Icon size={19} />}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="chart-reset-defaults"
                onClick={() => setDraft(defaultChartSettings(metric))}
              >
                <RotateCcw size={15} />
                Reset defaults
              </button>
            </div>
          )}
          {tab === "Grouping" && (
            <div className="chart-group-settings">
              {toggle("groupRuns", "Group runs")}
              {options("aggregate", "Agg", [
                ["mean", "Mean"],
                ["min", "Min"],
                ["max", "Max"],
              ])}
              {options("band", "Range", [
                ["range", "Min/Max"],
                ["stddev", "Std Dev"],
                ["stderr", "Std Err"],
                ["none", "None"],
              ])}
            </div>
          )}
          {tab === "Display preferences" && (
            <div className="chart-display-settings">
              <label className="chart-setting-toggle">
                <strong>Show legend</strong>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Show legend"
                  checked={draft.legend !== "none"}
                  onChange={(event) =>
                    update("legend", event.target.checked ? "top" : "none")
                  }
                />
              </label>
              {options("fontSize", "Font size", [
                ["small", "Small"],
                ["medium", "Medium"],
                ["large", "Large"],
                ["auto", "Auto"],
              ])}
              {options("legend", "Legend position", [
                ["top", "North"],
                ["bottom", "South"],
                ["right", "East"],
                ["left", "West"],
              ])}
              {select("legendValue", "Legend", [
                ["none", "Name"],
                ["last", "Name + latest value"],
                ["min", "Name + minimum"],
                ["max", "Name + maximum"],
              ])}
              <div className="chart-advanced-legend">
                <strong>▸ &nbsp; Advanced Legend</strong>
                {legendSeries.map((line) => (
                  <div key={line.id} className="chart-custom-legend-entry">
                    <span
                      style={{
                        color: draft.seriesStyles[line.id]?.color ?? line.color,
                      }}
                    >
                      {line.name} {line.metric}
                    </span>
                    <div className="chart-custom-legend-controls">
                      <input
                        type="color"
                        aria-label={`Series color ${line.name}`}
                        value={draft.seriesStyles[line.id]?.color ?? line.color}
                        onChange={(event) =>
                          update("seriesStyles", {
                            ...draft.seriesStyles,
                            [line.id]: {
                              ...draft.seriesStyles[line.id],
                              color: event.target.value,
                            },
                          })
                        }
                      />
                      <span className="chart-custom-line" />
                      <select
                        aria-label={`Line width for ${line.name}`}
                        value={
                          draft.seriesStyles[line.id]?.width ??
                          Math.round(draft.lineWidth)
                        }
                        onChange={(event) =>
                          update("seriesStyles", {
                            ...draft.seriesStyles,
                            [line.id]: {
                              ...draft.seriesStyles[line.id],
                              width: +event.target.value,
                            },
                          })
                        }
                      >
                        {[1, 2, 3, 4].map((value) => (
                          <option key={value} value={value}>
                            {value}px
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={`Legend label ${line.name}`}
                        value={draft.seriesLabels[line.id] ?? ""}
                        placeholder={line.name}
                        onChange={(event) =>
                          update("seriesLabels", {
                            ...draft.seriesLabels,
                            [line.id]: event.target.value,
                          })
                        }
                      />
                      <button
                        aria-label={`Reset legend ${line.name}`}
                        title="Reset legend"
                        onClick={() => {
                          const labels = { ...draft.seriesLabels },
                            styles = { ...draft.seriesStyles };
                          delete labels[line.id];
                          delete styles[line.id];
                          setDraft((previous) => ({
                            ...previous,
                            seriesLabels: labels,
                            seriesStyles: styles,
                          }));
                        }}
                      >
                        <RotateCcw size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                <small>
                  {
                    "Variables: ${name}, ${metric}, ${x}, ${mean}, ${min}, ${max}, ${last}, ${runs}"
                  }
                </small>
              </div>
              {select("tooltip", "Tooltip", [
                ["hover", "Follow pointer"],
                ["click", "Pin on click"],
              ])}
              <label className="chart-setting-field">
                <span>Line width</span>
                <input
                  type="number"
                  aria-label="Line width"
                  min={1}
                  max={4}
                  step={0.2}
                  value={draft.lineWidth}
                  onChange={(event) =>
                    update(
                      "lineWidth",
                      Math.max(1, Math.min(4, +event.target.value)),
                    )
                  }
                />
              </label>
              {toggle("showGrid", "Show grid lines")}
              {toggle("showPoints", "Show individual points")}
              {toggle("connectMissing", "Connect missing points")}
            </div>
          )}
          {tab === "Expressions" && (
            <div className="chart-expression-settings">
              <strong>Expressions</strong>
              <p>
                Add calculated metrics to your graph. For example{" "}
                <code>{"1 - ${accuracy}"}</code>.
              </p>
              {draft.expressions.map((value, index) => (
                <div key={index} className="chart-expression-row">
                  <label>
                    <span>Name</span>
                    <input
                      aria-label={`Expression ${index + 1} name`}
                      value={value.name}
                      onChange={(event) =>
                        update(
                          "expressions",
                          draft.expressions.map((item, i) =>
                            i === index
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Expression</span>
                    <input
                      aria-label={`Expression ${index + 1} formula`}
                      value={value.formula}
                      placeholder="1 - ${accuracy}"
                      onChange={(event) =>
                        update(
                          "expressions",
                          draft.expressions.map((item, i) =>
                            i === index
                              ? { ...item, formula: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    aria-label={`Remove expression ${index + 1}`}
                    onClick={() =>
                      update(
                        "expressions",
                        draft.expressions.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                className="toolbar-button"
                disabled={draft.expressions.length >= 10}
                onClick={() =>
                  update("expressions", [
                    ...draft.expressions,
                    { name: "", formula: "" },
                  ])
                }
              >
                <Plus size={16} />
                Add an Expression
              </button>
              <label className="chart-setting-field">
                <span>X Axis Expression</span>
                <input
                  aria-label="X Axis Expression"
                  value={draft.xExpression}
                  placeholder="x"
                  onChange={(event) =>
                    update("xExpression", event.target.value)
                  }
                />
              </label>
              <p className="chart-setting-note">
                {
                  "Useful variables: x, y, _step, _runtime, ${metric/name}, ${config:learning_rate}. Operators: + − * / ^; functions: abs, sqrt, log, log10, exp, min, max, pow."
                }
              </p>
            </div>
          )}
        </div>
        <footer className="chart-editor-footer">
          <button className="toolbar-button" onClick={onDelete}>
            Delete
          </button>
          <span
            className="chart-settings-error"
            role={error ? "alert" : undefined}
          >
            {error}
          </span>
          <button className="toolbar-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={!!error}
            onClick={() => onApply(draft)}
          >
            Apply
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
