"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import {
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Project, TuningParameterSpace } from "@/lib/data";
import type {
  TuningRunSortDirection,
  TuningRunSortKey,
  TuningStudy,
} from "@/lib/data/tuning";
import {
  bestRun,
  formatParameterSpace,
  metricValue,
  parameterValue,
  sortTuningRuns,
  trialNumber,
} from "@/lib/data/tuning";
import { filterLabels } from "@/lib/data/run-filters";
import { extent } from "@/lib/data/statistics";
import { compact } from "@/lib/data/chart-model";
import type { UniformPanelLayout } from "@/lib/data/panel-layout";
import Pagination from "./pagination";
import ViewHeader from "./view-header";
import TunerScatterPanel from "./tuner-scatter-panel";
import { CollapsedSidebar } from "./sidebar-heading";
import TunerStudiesSidebar from "./tuner-studies-sidebar";

const PAGE_SIZE = 10;
function parameterTicks(
  space: TuningParameterSpace | undefined,
  values: string[],
  numeric: boolean,
): number[] | undefined {
  if (!numeric) return values.map((_, index) => index);
  if (!space || space.type === "categorical") return undefined;
  if (space.step && (space.high - space.low) / space.step <= 10)
    return Array.from(
      {
        length:
          Math.floor((space.high - space.low) / space.step + 0.000001) + 1,
      },
      (_, index) => Number((space.low + index * space.step!).toPrecision(10)),
    );
  if (space.log && space.low > 0) {
    const powers = Array.from(
      {
        length:
          Math.floor(Math.log10(space.high)) -
          Math.ceil(Math.log10(space.low)) +
          1,
      },
      (_, index) => 10 ** (Math.ceil(Math.log10(space.low)) + index),
    );
    return [...new Set([space.low, ...powers, space.high])].filter(
      (value) => value >= space.low && value <= space.high,
    );
  }
  return Array.from({ length: 5 }, (_, index) =>
    Number((space.low + ((space.high - space.low) * index) / 4).toPrecision(6)),
  );
}

export default function TunerOverview({
  study,
  selectedIds,
  onSelectionChange,
  trialColors,
  studies,
  project,
  chooseStudy,
  plotOrder,
  onPlotOrderChange,
  plotLayout,
  onPlotLayoutChange,
  sidebarOpen,
  onSidebarOpenChange,
  studySearch,
  onStudySearchChange,
}: {
  study: TuningStudy;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  trialColors: Record<string, string>;
  studies: TuningStudy[];
  project: Project | null;
  chooseStudy: (id: string) => void;
  plotOrder: string[];
  onPlotOrderChange: (order: string[]) => void;
  plotLayout: UniformPanelLayout;
  onPlotLayoutChange: (layout: UniformPanelLayout | null) => void;
  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
  studySearch: string;
  onStudySearchChange: (search: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [requestedSort, setRequestedSort] = useState<{
    studyId: string;
    key: TuningRunSortKey;
    direction: TuningRunSortDirection;
  } | null>(null);
  const selectedSet = new Set(selectedIds);
  const allSelected = selectedIds.length === study.runs.length;
  const toggleRun = (id: string) => {
    onSelectionChange(
      selectedSet.has(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id],
    );
  };
  const toggleGraphPoint = (id: string) => {
    if (allSelected) onSelectionChange([id]);
    else toggleRun(id);
  };
  const selectAll = () => onSelectionChange(study.runs.map((run) => run.id));
  const selectNone = () => onSelectionChange([]);
  const objective =
    project?.metrics.find((item) => item.key === study.objectiveKey) ??
    (study.objectiveKey
      ? {
          key: study.objectiveKey,
          label: study.objectiveKey,
          preferredDirection: "minimize" as const,
        }
      : undefined);
  const best = objective ? bestRun(study.runs, objective) : undefined;
  const direction = objective?.preferredDirection === "minimize" ? 1 : -1;
  const defaultDirection: TuningRunSortDirection =
    objective?.preferredDirection === "maximize" ? "desc" : "asc";
  const sort =
    requestedSort?.studyId === study.id
      ? requestedSort
      : {
          studyId: study.id,
          key: objective ? ("objective" as const) : ("trial" as const),
          direction: defaultDirection,
        };
  const changeSort = (key: TuningRunSortKey) => {
    setRequestedSort({
      studyId: study.id,
      key,
      direction: sort.key === key && sort.direction === "asc" ? "desc" : "asc",
    });
    setPage(0);
  };
  const sortHeader = (key: TuningRunSortKey, label: string) => (
    <th
      key={key}
      scope="col"
      aria-sort={
        sort.key === key
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        className="tuner-sort-button"
        onClick={() => changeSort(key)}
      >
        {label}
        {sort.key === key &&
          (sort.direction === "asc" ? (
            <ArrowUp size={13} aria-hidden="true" />
          ) : (
            <ArrowDown size={13} aria-hidden="true" />
          ))}
      </button>
    </th>
  );
  const filtered = useMemo(
    () =>
      sortTuningRuns(
        study.runs.filter((run) =>
          `${run.name} ${run.id} ${trialNumber(run) ?? ""}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        ),
        sort.key,
        sort.direction,
        study.objectiveKey,
      ),
    [study.runs, search, sort.key, sort.direction, study.objectiveKey],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRuns = filtered.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const selected =
    selectedIds.length === 1
      ? study.runs.find((run) => run.id === selectedIds[0])
      : undefined;
  const varied = useMemo(
    () =>
      study.parameters.filter(
        (key) =>
          new Set(study.runs.map((run) => parameterValue(run, key))).size > 1,
      ),
    [study.parameters, study.runs],
  );
  const entryLabel = study.objectiveKey ? "trials" : "runs";
  const [minTrial, maxTrial] = extent(
    study.runs.map((run, index) => trialNumber(run) ?? index),
  );
  const optimizationHistory = objective
    ? study.runs
        .map((run, index) => ({
          run,
          trial: trialNumber(run) ?? index,
          value: metricValue(run, objective.key),
        }))
        .filter(
          (point): point is typeof point & { value: number } =>
            point.value !== undefined,
        )
        .toSorted((a, b) => a.trial - b.trial)
        .reduce<
          Array<{
            runId: string;
            trial: number;
            value: number;
            best?: number;
            name: string;
            color: string;
          }>
        >((points, point) => {
          const previousBest = points.at(-1)?.best;
          const bestSoFar =
            point.run.status === "finished" &&
            (previousBest === undefined ||
              direction * point.value < direction * previousBest)
              ? point.value
              : previousBest;
          points.push({
            runId: point.run.id,
            trial: point.trial,
            value: point.value,
            best: bestSoFar,
            name: point.run.name,
            color: trialColors[point.run.id],
          });
          return points;
        }, [])
    : [];
  const parameterPlots = objective
    ? study.parameters.map((key) => {
        const space = study.searchSpace?.[key];
        const values = [
          ...new Set([
            ...(space?.type === "categorical" ? space.choices.map(String) : []),
            ...study.runs
              .map((run) => parameterValue(run, key))
              .filter((value): value is string => value !== undefined),
          ]),
        ];
        const numeric =
          space?.type !== "categorical" &&
          values.length > 0 &&
          values.every((value) => Number.isFinite(Number(value)));
        if (space?.type !== "categorical")
          values.sort(
            numeric
              ? (a, b) => Number(a) - Number(b)
              : (a, b) => a.localeCompare(b),
          );
        const points = study.runs.flatMap((run, index) => {
          const value = parameterValue(run, key);
          const y = metricValue(run, objective.key);
          if (value === undefined || y === undefined) return [];
          const trial = trialNumber(run) ?? index;
          return [
            {
              runId: run.id,
              x: numeric ? Number(value) : values.indexOf(value),
              y,
              value,
              trial,
              name: run.name,
              color: trialColors[run.id],
            },
          ];
        });
        const [observedLow, observedHigh] = extent(values.map(Number));
        const observedPadding =
          (observedHigh - observedLow || Math.abs(observedLow) || 1) * 0.06;
        const domain: [number, number] =
          numeric && (space?.type === "float" || space?.type === "int")
            ? [
                space.low - (space.high - space.low || 1) * 0.06,
                space.high + (space.high - space.low || 1) * 0.06,
              ]
            : numeric
              ? [observedLow - observedPadding, observedHigh + observedPadding]
              : [-0.65, values.length - 0.35];
        const ticks = parameterTicks(space, values, numeric);
        return { key, values, numeric, points, domain, space, ticks };
      })
    : [];
  const orderedPlots = parameterPlots.toSorted((a, b) => {
    const order = [...new Set([...plotOrder, ...study.parameters])];
    return order.indexOf(a.key) - order.indexOf(b.key);
  });
  const movePlot = (source: string, target: string) => {
    if (source === target) return;
    const order = orderedPlots.map((plot) => plot.key);
    const from = order.indexOf(source),
      to = order.indexOf(target);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, source);
    onPlotOrderChange(order);
  };
  const movePlotByOffset = (key: string, offset: number) => {
    const order = orderedPlots.map((plot) => plot.key);
    const index = order.indexOf(key);
    const target = order[index + offset];
    if (target) movePlot(key, target);
  };
  return (
    <section className="tuner-view" aria-label="MagicTuner">
      <div
        className={`tuner-overview-body ${sidebarOpen ? "" : "sidebar-hidden"}`}
      >
        {!sidebarOpen && (
          <CollapsedSidebar
            label="Open studies sidebar"
            onOpen={() => onSidebarOpenChange(true)}
          />
        )}
        {sidebarOpen && (
          <TunerStudiesSidebar
            studies={studies}
            selectedStudyId={study.id}
            search={studySearch}
            onSearchChange={onStudySearchChange}
            onChooseStudy={(id) => {
              chooseStudy(id);
              setPage(0);
            }}
            onClose={() => onSidebarOpenChange(false)}
          />
        )}
        <div className="tuner-main">
          <ViewHeader
            title="Overview"
            badge={
              project?.isSample ? (
                <span className="tuner-sample">Sample data</span>
              ) : undefined
            }
          />
          <div className="tuner-scroll">
            <div className="tuner-overview-content">
              <div className="tuner-overview-heading">
                <h2>{study.name}</h2>
                <span>
                  {objective
                    ? `Objective: ${objective.label} · ${objective.preferredDirection ?? "maximize"}`
                    : "No optimization objective recorded"}
                </span>
              </div>
              <div className="tuner-summary">
                <div>
                  <span>Best objective</span>
                  <strong>
                    {best && objective
                      ? compact(metricValue(best, objective.key)!)
                      : "—"}
                  </strong>
                  <small>{best?.name ?? "No completed objective value"}</small>
                </div>
                <div>
                  <span>{study.objectiveKey ? "Trials" : "Runs"}</span>
                  <strong>{study.runs.length}</strong>
                  <small>
                    {
                      study.runs.filter((run) => run.status === "finished")
                        .length
                    }{" "}
                    finished
                  </small>
                </div>
                <div>
                  <span>Parameters</span>
                  <strong>{study.parameters.length}</strong>
                  <small>{varied.length} varied</small>
                </div>
              </div>
              {objective && (
                <section
                  className="chart-card tuner-history-card"
                  aria-label="Optimization history"
                >
                  <h3>Optimization history</h3>
                  {optimizationHistory.length ? (
                    <div
                      className="chart-plot tuner-history-plot"
                      role="group"
                      aria-label={`${objective.label} by trial number with best completed value`}
                      onClick={selectAll}
                    >
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                        minWidth={0}
                      >
                        <ComposedChart
                          data={optimizationHistory}
                          margin={{ top: 14, right: 24, bottom: 24, left: 16 }}
                        >
                          <CartesianGrid
                            stroke="var(--line)"
                            strokeDasharray="3 3"
                          />
                          <XAxis
                            dataKey="trial"
                            type="number"
                            domain={["dataMin", "dataMax"]}
                            tick={{ fontSize: 12 }}
                            label={{
                              value: "Trial",
                              position: "insideBottom",
                              offset: -12,
                              fontSize: 13,
                            }}
                          />
                          <YAxis
                            type="number"
                            domain={["auto", "auto"]}
                            tickFormatter={compact}
                            tick={{ fontSize: 12 }}
                            width={48}
                            label={{
                              value: "Objective Value",
                              angle: -90,
                              position: "insideLeft",
                              fontSize: 13,
                            }}
                          />
                          <Tooltip
                            labelFormatter={(value) => `Trial ${value}`}
                            formatter={(value, name) => [
                              typeof value === "number"
                                ? compact(value)
                                : value,
                              name === "best"
                                ? "Best completed"
                                : objective.label,
                            ]}
                          />
                          <Line
                            dataKey="best"
                            stroke="#8795a8"
                            strokeWidth={1.5}
                            dot={false}
                            activeDot={false}
                            connectNulls
                            isAnimationActive={false}
                            name="best"
                          />
                          <Scatter
                            data={optimizationHistory}
                            dataKey="value"
                            isAnimationActive={false}
                            name="value"
                            onClick={(point, _index, event) => {
                              event.stopPropagation();
                              if (typeof point.payload?.runId === "string")
                                toggleGraphPoint(point.payload.runId);
                            }}
                          >
                            {optimizationHistory.map((point) => (
                              <Cell
                                key={point.runId}
                                fill={point.color}
                                fillOpacity={
                                  selectedSet.has(point.runId) ? 1 : 0.13
                                }
                                stroke={
                                  selectedSet.has(point.runId)
                                    ? "var(--theme-text, #25364a)"
                                    : "none"
                                }
                                strokeWidth={
                                  selectedSet.has(point.runId) ? 1.5 : 0
                                }
                              />
                            ))}
                          </Scatter>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="tuner-chart-empty">
                      No objective values recorded.
                    </div>
                  )}
                </section>
              )}
              <section className="tuner-panel tuner-parameters">
                <div className="tuner-panel-heading">
                  <h3>Parameter space</h3>
                  <span>Search space, best trial, and observed values</span>
                </div>
                <div className="tuner-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Search space</th>
                        <th>Best trial</th>
                        <th>Observed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {study.parameters.map((key) => {
                        const values = [
                          ...new Set(
                            study.runs
                              .map((run) => parameterValue(run, key))
                              .filter(
                                (value): value is string => value !== undefined,
                              ),
                          ),
                        ];
                        return (
                          <tr key={key}>
                            <td>{filterLabels[key] ?? key}</td>
                            <td>
                              {study.searchSpace?.[key]
                                ? formatParameterSpace(study.searchSpace[key])
                                : "—"}
                            </td>
                            <td>
                              {best ? (parameterValue(best, key) ?? "—") : "—"}
                            </td>
                            <td title={values.join(", ")}>
                              {values.length > 5
                                ? `${values.length} values`
                                : values.join(" · ")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
              {objective && (
                <section
                  className="tuner-parameter-plots"
                  aria-label="Optuna parameter plots"
                >
                  <div className="tuner-plots-heading">
                    <h3>Trial outcomes by parameter</h3>
                    <span>
                      Each point is a trial · color shows trial number
                    </span>
                  </div>
                  <div
                    className="chart-grid chart-grid-uniform tuner-plot-grid"
                    style={
                      { "--panel-columns": plotLayout.columns } as CSSProperties
                    }
                  >
                    {orderedPlots.map(
                      ({
                        key,
                        values,
                        numeric,
                        points,
                        domain,
                        space,
                        ticks,
                      }) => (
                        <TunerScatterPanel
                          key={key}
                          label={filterLabels[key] ?? key}
                          spaceLabel={
                            space
                              ? `Search space: ${formatParameterSpace(space)}`
                              : "Observed parameter values"
                          }
                          objectiveLabel={objective.label}
                          points={points}
                          selectedIds={selectedSet}
                          onToggleTrial={toggleGraphPoint}
                          onSelectAll={selectAll}
                          values={values}
                          numeric={numeric}
                          domain={domain}
                          ticks={ticks}
                          minTrial={minTrial}
                          maxTrial={maxTrial}
                          plotKey={key}
                          layout={plotLayout}
                          onLayoutChange={onPlotLayoutChange}
                          onMove={movePlot}
                          onMoveByOffset={(offset) =>
                            movePlotByOffset(key, offset)
                          }
                        />
                      ),
                    )}
                  </div>
                </section>
              )}
              <section className="tuner-panel tuner-trials">
                <div className="tuner-panel-heading">
                  <div>
                    <h3>
                      {study.objectiveKey ? "Optuna trials" : "Study runs"}
                    </h3>
                    <span>
                      {selectedIds.length} of {study.runs.length} shown in
                      graphs
                    </span>
                  </div>
                  <div
                    className="tuner-selection-actions"
                    role="group"
                    aria-label="Select tuning runs"
                  >
                    <button
                      type="button"
                      onClick={selectAll}
                      disabled={allSelected}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={selectNone}
                      disabled={!selectedIds.length}
                    >
                      None
                    </button>
                  </div>
                  <label className="tuner-search">
                    <Search size={15} />
                    <input
                      aria-label="Search tuning runs"
                      placeholder={`Search ${entryLabel}`}
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(0);
                      }}
                    />
                  </label>
                </div>
                <div className="tuner-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th className="tuner-checkbox-cell">
                          <input
                            type="checkbox"
                            aria-label={`Select all ${entryLabel}`}
                            checked={allSelected}
                            ref={(node) => {
                              if (node)
                                node.indeterminate =
                                  selectedIds.length > 0 && !allSelected;
                            }}
                            onChange={() =>
                              allSelected ? selectNone() : selectAll()
                            }
                          />
                        </th>
                        {sortHeader(
                          "trial",
                          study.objectiveKey ? "Trial" : "Run",
                        )}
                        {sortHeader(
                          "objective",
                          `Objective${objective ? ` · ${objective.label}` : ""}`,
                        )}
                        {study.parameters.map((key) =>
                          sortHeader(
                            `parameter:${key}`,
                            filterLabels[key] ?? key,
                          ),
                        )}
                        {sortHeader("status", "Status")}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRuns.map((run) => (
                        <tr
                          key={run.id}
                          className="tuner-selectable-row"
                          onClick={() => toggleRun(run.id)}
                        >
                          <td className="tuner-checkbox-cell">
                            <input
                              type="checkbox"
                              aria-label={`Select ${run.name}`}
                              checked={selectedSet.has(run.id)}
                              onChange={() => toggleRun(run.id)}
                              onClick={(event) => event.stopPropagation()}
                            />
                          </td>
                          <td>
                            <button
                              className="tuner-run-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleRun(run.id);
                              }}
                              aria-pressed={selectedSet.has(run.id)}
                            >
                              {trialNumber(run) !== undefined
                                ? `#${trialNumber(run)} · `
                                : ""}
                              {run.name}
                            </button>
                          </td>
                          <td>
                            {objective &&
                            metricValue(run, objective.key) !== undefined
                              ? compact(metricValue(run, objective.key)!)
                              : "—"}
                          </td>
                          {study.parameters.map((key) => (
                            <td key={key}>{parameterValue(run, key) ?? "—"}</td>
                          ))}
                          <td>{run.status}</td>
                        </tr>
                      ))}
                      {!visibleRuns.length && (
                        <tr>
                          <td colSpan={study.parameters.length + 4}>
                            No matching {entryLabel}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="tuner-pagination">
                  <Pagination
                    total={filtered.length}
                    page={currentPage}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                    label={entryLabel}
                  />
                </div>
                {selected && (
                  <div className="tuner-run-detail">
                    <strong>{selected.name}</strong>
                    <span>{selected.status}</span>
                    <dl>
                      {study.parameters.map((key) => (
                        <div key={key}>
                          <dt>{filterLabels[key] ?? key}</dt>
                          <dd>{parameterValue(selected, key) ?? "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
