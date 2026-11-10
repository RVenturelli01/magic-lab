"use client";

import { useMemo, useState } from "react";
import type { MetricDefinition, MetricPoint, Project, Run } from "@/lib/data";
import MetricChart from "./metric-chart";
import type { Series } from "@/lib/data/chart-model";
import type { FilterFacet as Facet } from "./filter-controls";
import { filterValue, optionLabel as valueLabel } from "@/lib/data/run-filters";
import ViewHeader from "./view-header";

type ChartSize = { width: number; height: number };
const EMPTY_METRICS: MetricDefinition[] = [];
const DEFAULT_SIZE: ChartSize = { width: 400, height: 465 };

const configValue = (run: Run, key: string) => filterValue(run, key)[0];

export default function Ablations({
  runs,
  histories,
  project,
  facets,
  loading,
  smoothing,
}: {
  runs: Run[];
  histories: Record<string, MetricPoint[]>;
  project: Project | null;
  facets: Facet[];
  loading: boolean;
  smoothing: number;
}) {
  const axes = useMemo(
    () =>
      facets.filter(
        (facet) => facet.key.startsWith("config:") && facet.options.length > 1,
      ),
    [facets],
  );
  const availableMetrics = project?.metrics ?? EMPTY_METRICS;
  const [rowChoice, setRowChoice] = useState("config:batch_size");
  const [columnChoice, setColumnChoice] = useState("config:algorithm");
  const [metricChoices, setMetricChoices] = useState(["eval/mean_reward"]);
  const [xAxis, setXAxis] = useState("step");
  const [removedCells, setRemovedCells] = useState<string[]>([]);
  const [chartSize, setChartSize] = useState(DEFAULT_SIZE);
  const [sizeCustomized, setSizeCustomized] = useState(false);

  const activeMetrics = useMemo(() => {
    const keys = metricChoices.filter((key) =>
      availableMetrics.some((metric) => metric.key === key),
    );
    if (!keys.length && availableMetrics[0]) keys.push(availableMetrics[0].key);
    return keys;
  }, [metricChoices, availableMetrics]);
  const rowKey =
    rowChoice === "none" ||
    rowChoice === "metrics" ||
    axes.some((facet) => facet.key === rowChoice)
      ? rowChoice
      : (axes[0]?.key ?? "none");
  const columnKey =
    columnChoice === "none" ||
    (columnChoice === "metrics" && rowKey !== "metrics") ||
    axes.some((facet) => facet.key === columnChoice && facet.key !== rowKey)
      ? columnChoice
      : columnChoice === "metrics"
        ? "none"
        : (axes.find((facet) => facet.key !== rowKey)?.key ?? "none");
  const rowFacet = axes.find((facet) => facet.key === rowKey);
  const columnFacet = axes.find((facet) => facet.key === columnKey);
  const rowValues = useMemo(
    () =>
      rowKey === "none"
        ? ["all"]
        : rowKey === "metrics"
          ? activeMetrics
          : (rowFacet?.options.filter((value) =>
              runs.some((run) => configValue(run, rowKey) === value),
            ) ?? []),
    [rowKey, activeMetrics, rowFacet, runs],
  );
  const columnValues = useMemo(
    () =>
      columnKey === "none"
        ? ["all"]
        : columnKey === "metrics"
          ? activeMetrics
          : (columnFacet?.options.filter((value) =>
              runs.some((run) => configValue(run, columnKey) === value),
            ) ?? []),
    [columnKey, activeMetrics, columnFacet, runs],
  );
  const cells = useMemo(() => {
    const result = new Map<
      string,
      {
        cellRuns: Run[];
        cellMetrics: string[];
        cellKey: string;
        series: Series[];
      }
    >();
    for (const row of rowValues)
      for (const column of columnValues) {
        const cellRuns = runs.filter(
          (run) =>
            (rowKey === "none" ||
              rowKey === "metrics" ||
              configValue(run, rowKey) === row) &&
            (columnKey === "none" ||
              columnKey === "metrics" ||
              configValue(run, columnKey) === column),
        );
        const cellMetrics =
          rowKey === "metrics"
            ? [row]
            : columnKey === "metrics"
              ? [column]
              : activeMetrics;
        const cellKey = `${rowKey}:${row}|${columnKey}:${column}|${cellMetrics.join(",")}`;
        const seriesName = [
          rowKey === "none" || rowKey === "metrics"
            ? "All runs"
            : `${rowFacet?.label} ${valueLabel(row)}`,
          columnKey === "none" || columnKey === "metrics"
            ? ""
            : `${columnFacet?.label} ${valueLabel(column)}`,
        ]
          .filter(Boolean)
          .join(" · ");
        const series: Series[] = cellRuns.length
          ? [
              {
                id: cellKey,
                name: seriesName,
                color: cellRuns[0].color,
                runs: cellRuns,
              },
            ]
          : [];

        result.set(JSON.stringify([row, column]), {
          cellRuns,
          cellMetrics,
          cellKey,
          series,
        });
      }
    return result;
  }, [
    runs,
    rowValues,
    columnValues,
    rowKey,
    columnKey,
    activeMetrics,
    rowFacet,
    columnFacet,
  ]);
  const chartColumnWidth = sizeCustomized
    ? `${chartSize.width + 16}px`
    : `minmax(${chartSize.width + 16}px, 1fr)`;
  const gridColumns = `132px repeat(${columnValues.length}, ${chartColumnWidth})`;
  const changeChartSize = (size: ChartSize | null) => {
    setChartSize(size ?? DEFAULT_SIZE);
    setSizeCustomized(size !== null);
  };
  const toggleMetric = (key: string) => {
    setMetricChoices((previous) =>
      previous.includes(key)
        ? previous.length > 1
          ? previous.filter((item) => item !== key)
          : previous
        : [...previous, key],
    );
  };

  return (
    <section className="ablation-view" aria-label="Ablations">
      <ViewHeader
        title="Ablations"
        actions={<span className="view-intro-meta">{runs.length} runs</span>}
      />
      <div className="ablation-controls">
        <label>
          Rows
          <select
            aria-label="Ablation rows"
            value={rowKey}
            onChange={(event) => {
              setRowChoice(event.target.value);
              if (event.target.value === "metrics" && columnKey === "metrics")
                setColumnChoice("none");
            }}
          >
            <option value="none">All runs</option>
            <option value="metrics">Metrics</option>
            {axes
              .filter((facet) => facet.key !== columnKey)
              .map((facet) => (
                <option key={facet.key} value={facet.key}>
                  {facet.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Columns
          <select
            aria-label="Ablation columns"
            value={columnKey}
            onChange={(event) => {
              setColumnChoice(event.target.value);
              if (event.target.value === "metrics" && rowKey === "metrics")
                setRowChoice("none");
            }}
          >
            <option value="none">All runs</option>
            <option value="metrics">Metrics</option>
            {axes
              .filter((facet) => facet.key !== rowKey)
              .map((facet) => (
                <option key={facet.key} value={facet.key}>
                  {facet.label}
                </option>
              ))}
          </select>
        </label>
        <div className="ablation-metrics-control">
          <span>Plot</span>
          <details className="ablation-metric-picker">
            <summary>
              {activeMetrics.length === 1
                ? availableMetrics.find((item) => item.key === activeMetrics[0])
                    ?.label
                : `${activeMetrics.length} metrics`}
            </summary>
            <div className="ablation-metric-options">
              {availableMetrics.map((metric) => (
                <label key={metric.key}>
                  <input
                    type="checkbox"
                    checked={activeMetrics.includes(metric.key)}
                    disabled={
                      activeMetrics.length === 1 &&
                      activeMetrics.includes(metric.key)
                    }
                    onChange={() => toggleMetric(metric.key)}
                  />
                  {metric.label}
                </label>
              ))}
            </div>
          </details>
        </div>
        <label>
          X axis
          <select
            aria-label="Ablation X axis"
            value={xAxis}
            onChange={(event) => setXAxis(event.target.value)}
          >
            <option value="step">Step</option>
            <option value="runtime">Relative time</option>
            <option value="timestamp">Wall time</option>
            {availableMetrics.map((metric) => (
              <option key={metric.key} value={`metric:${metric.key}`}>
                {metric.label}
              </option>
            ))}
          </select>
        </label>
        <span className="ablation-control-hint">
          {rowKey === "metrics"
            ? "One metric per row"
            : columnKey === "metrics"
              ? "One metric per column"
              : activeMetrics.length > 1
                ? "Metrics overlaid in each chart"
                : ""}
        </span>
      </div>
      {activeMetrics.length && rowValues.length && columnValues.length ? (
        <div className="ablation-scroll">
          <div
            className="ablation-grid"
            style={{ gridTemplateColumns: gridColumns }}
          >
            <div className="ablation-corner">
              {rowKey === "metrics" ? "Metrics" : (rowFacet?.label ?? "Runs")} ↓
              <br />
              {columnKey === "metrics"
                ? "Metrics"
                : (columnFacet?.label ?? "Runs")}{" "}
              →
            </div>
            {columnValues.map((column) => (
              <div className="ablation-column" key={column}>
                {columnKey === "metrics" ? (
                  <strong>
                    {availableMetrics.find((item) => item.key === column)
                      ?.label ?? column}
                  </strong>
                ) : columnKey === "none" ? (
                  <strong>All runs</strong>
                ) : (
                  <>
                    {columnFacet?.label} = <strong>{valueLabel(column)}</strong>
                  </>
                )}
              </div>
            ))}
            {rowValues.map((row) => (
              <div
                className="ablation-grid-row"
                key={row}
                style={{
                  gridColumn: `1 / span ${columnValues.length + 1}`,
                  gridTemplateColumns: gridColumns,
                }}
              >
                <div className="ablation-row-label">
                  {rowKey === "none" ? (
                    <strong>All runs</strong>
                  ) : rowKey === "metrics" ? (
                    <strong>
                      {availableMetrics.find((item) => item.key === row)
                        ?.label ?? row}
                    </strong>
                  ) : (
                    <>
                      {rowFacet?.label}
                      <strong>{valueLabel(row)}</strong>
                    </>
                  )}
                </div>
                {columnValues.map((column) => {
                  const { cellRuns, cellMetrics, cellKey, series } = cells.get(
                    JSON.stringify([row, column]),
                  )!;
                  return (
                    <div className="ablation-cell" key={column}>
                      {!cellRuns.length ? (
                        <div
                          className="ablation-empty"
                          style={{ minHeight: chartSize.height }}
                        >
                          No runs for this combination
                        </div>
                      ) : removedCells.includes(cellKey) ? (
                        <button
                          className="ablation-restore"
                          style={{ minHeight: chartSize.height }}
                          onClick={() =>
                            setRemovedCells((previous) =>
                              previous.filter((key) => key !== cellKey),
                            )
                          }
                        >
                          Add chart
                        </button>
                      ) : (
                        <MetricChart
                          key={cellKey}
                          metric={cellMetrics[0]}
                          series={series}
                          histories={histories}
                          metrics={availableMetrics}
                          loading={loading}
                          smoothing={smoothing}
                          scope={`ablations:${rowKey}:${row}:${columnKey}:${column}`}
                          defaultSpan={12}
                          sharedSize={chartSize}
                          onSharedSizeChange={changeChartSize}
                          sharedSelection={{ metrics: cellMetrics, xAxis }}
                          onRemoveMetric={() =>
                            setRemovedCells((previous) => [
                              ...previous,
                              cellKey,
                            ])
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          Choose metrics and run dimensions to build the grid.
        </div>
      )}
    </section>
  );
}
