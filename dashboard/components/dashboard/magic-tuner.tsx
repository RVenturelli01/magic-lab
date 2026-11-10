"use client";
import Pagination from "./pagination";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowDownUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
} from "lucide-react";
import type {
  MetricPoint,
  Project,
  Run,
  TuningStudyDefinition,
} from "@/lib/data";
import {
  buildTuningStudies,
  metricValue,
  trialNumber,
} from "@/lib/data/tuning";
import type { Series } from "@/lib/data/chart-model";
import { extent } from "@/lib/data/statistics";
import { lazyView } from "./lazy-view";
const MetricChart = lazyView(() => import("./metric-chart"));
import {
  DEFAULT_PANEL_HEIGHT,
  MAX_PANEL_COLUMNS,
  MIN_PANEL_HEIGHT,
  MAX_PANEL_HEIGHT,
  type UniformPanelLayout,
} from "@/lib/data/panel-layout";
import ViewHeader from "./view-header";
import {
  FilterBoard,
  FilterColumnHeader,
  FilterToggle,
  isSelectedFilterValue,
  swapFilterKeys,
  useFilterReorder,
} from "./filter-controls";
import SelectionTable from "./selection-table";
import SelectionRadio from "./selection-radio";
const TunerOverview = lazyView(() => import("./tuner-overview"));
import { CollapsedSidebar } from "./sidebar-heading";
import TunerStudiesSidebar from "./tuner-studies-sidebar";

const PAGE_SIZE = 10;
const SELECTION_STORAGE_KEY = "magic-tuner-selection-v1";
const OVERVIEW_LAYOUT_STORAGE_KEY = "magic-tuner-overview-layout-v1";
const EMPTY_STUDY_DEFINITIONS: TuningStudyDefinition[] = [];

const TRIAL_COLORS = [
  "#440154",
  "#414487",
  "#2a788e",
  "#22a884",
  "#7ad151",
  "#fde725",
];

function trialColor(position: number): string {
  const scaled = Math.max(0, Math.min(1, position)) * (TRIAL_COLORS.length - 1);
  const lower = Math.floor(scaled);
  const upper = Math.min(TRIAL_COLORS.length - 1, lower + 1);
  const fraction = scaled - lower;
  const rgb = [1, 3, 5].map((offset) =>
    Math.round(
      parseInt(TRIAL_COLORS[lower].slice(offset, offset + 2), 16) *
        (1 - fraction) +
        parseInt(TRIAL_COLORS[upper].slice(offset, offset + 2), 16) * fraction,
    ),
  );
  return `rgb(${rgb.join(",")})`;
}

export default function MagicTuner({
  runs,
  project,
  histories,
  historiesLoading,
  definitions = EMPTY_STUDY_DEFINITIONS,
  loading,
  error,
  onRetry,
  view,
}: {
  runs: Run[];
  project: Project | null;
  histories: Record<string, MetricPoint[]>;
  historiesLoading: boolean;
  definitions?: TuningStudyDefinition[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  view: "selection" | "overview" | "charts";
}) {
  const studies = useMemo(
    () => buildTuningStudies(runs, definitions),
    [runs, definitions],
  );
  const allTrials =
    studies.length > 0 && studies.every((item) => item.objectiveKey);
  const [studyChoice, setStudyChoice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [studySearch, setStudySearch] = useState("");
  const [studyPage, setStudyPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterPickerOpen, setFilterPickerOpen] = useState(false);
  const [visibleFilterKeys, setVisibleFilterKeys] = useState<string[]>([
    "study",
    "completion",
  ]);
  const [selectedFilters, setSelectedFilters] = useState<
    Record<string, string[]>
  >({});
  const [sortByRuns, setSortByRuns] = useState(false);
  const [selectionReady, setSelectionReady] = useState(false);
  const [chartPanelChoice, setChartPanelChoice] = useState<string[] | null>(
    null,
  );
  const [focusedMetric, setFocusedMetric] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
  const [selection, setSelection] = useState<{
    studyId: string;
    ids: string[];
  } | null>(null);
  const [columns, setColumns] = useState(2);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);
  const [showPanelPicker, setShowPanelPicker] = useState(false);
  const [overviewPlotOrders, setOverviewPlotOrders] = useState<
    Record<string, string[]>
  >({});
  const [overviewLayout, setOverviewLayout] = useState<UniformPanelLayout>({
    columns: 2,
    height: DEFAULT_PANEL_HEIGHT,
  });
  const [overviewLayoutReady, setOverviewLayoutReady] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const saved = JSON.parse(
        localStorage.getItem(OVERVIEW_LAYOUT_STORAGE_KEY) || "null",
      );
      if (
        saved &&
        Number.isInteger(saved.columns) &&
        saved.columns >= 1 &&
        saved.columns <= MAX_PANEL_COLUMNS &&
        Number.isFinite(saved.height) &&
        saved.height >= MIN_PANEL_HEIGHT &&
        saved.height <= MAX_PANEL_HEIGHT
      )
        setOverviewLayout({
          columns: saved.columns,
          height: Math.round(saved.height),
        });
    } catch {
      // Invalid or unavailable storage leaves the default layout in place.
    }
    setOverviewLayoutReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!overviewLayoutReady) return;
    try {
      localStorage.setItem(
        OVERVIEW_LAYOUT_STORAGE_KEY,
        JSON.stringify(overviewLayout),
      );
    } catch {
      // Resizing remains available without persistent storage.
    }
  }, [overviewLayout, overviewLayoutReady]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const stored = localStorage.getItem(SELECTION_STORAGE_KEY);
      if (stored) {
        const value = JSON.parse(stored) as Record<string, unknown>;
        if (typeof value.filtersOpen === "boolean")
          setFiltersOpen(value.filtersOpen);
        const visibleKeys = Array.isArray(value.visibleFilterKeys)
          ? value.visibleFilterKeys.filter(
              (key): key is string => key === "study" || key === "completion",
            )
          : ["study", "completion"];
        const activeKeys: string[] = [];
        if (
          value.selectedFilters &&
          typeof value.selectedFilters === "object"
        ) {
          const filters = value.selectedFilters as Record<string, unknown>;
          const restored = Object.fromEntries(
            ["study", "completion"].map((key) => [
              key,
              Array.isArray(filters[key])
                ? filters[key].filter(
                    (option): option is string => typeof option === "string",
                  )
                : [],
            ]),
          ) as Record<string, string[]>;
          activeKeys.push(
            ...Object.keys(restored).filter((key) => restored[key].length),
          );
          setSelectedFilters(restored);
        }
        setVisibleFilterKeys([...new Set([...visibleKeys, ...activeKeys])]);
        if (typeof value.sortByRuns === "boolean")
          setSortByRuns(value.sortByRuns);
      }
    } catch {
      // Invalid saved settings fall back to the selection defaults.
    }
    setSelectionReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => {
    if (!selectionReady) return;
    try {
      localStorage.setItem(
        SELECTION_STORAGE_KEY,
        JSON.stringify({
          filtersOpen,
          visibleFilterKeys,
          selectedFilters,
          sortByRuns,
        }),
      );
    } catch {
      // Selection remains usable when browser storage is unavailable.
    }
  }, [
    selectionReady,
    filtersOpen,
    visibleFilterKeys,
    selectedFilters,
    sortByRuns,
  ]);

  const completionLabel = (item: (typeof studies)[number]) =>
    item.runs.every((run) => run.status === "finished")
      ? "Complete"
      : "Incomplete";
  const facets = [
    { key: "study", label: "Study", options: studies.map((item) => item.id) },
    {
      key: "completion",
      label: "Completion",
      options: [...new Set(studies.map(completionLabel))],
    },
  ];
  const matchesStudy = (item: (typeof studies)[number], except?: string) =>
    (!selectedFilters.study?.length ||
      except === "study" ||
      selectedFilters.study.includes(item.id)) &&
    (!selectedFilters.completion?.length ||
      except === "completion" ||
      selectedFilters.completion.includes(completionLabel(item)));
  const matchingStudies = studies.filter((item) => matchesStudy(item));
  const swapFilters = (source: string, target: string) =>
    setVisibleFilterKeys((keys) => swapFilterKeys(keys, source, target));
  const filterReorder = useFilterReorder(visibleFilterKeys, swapFilters);
  const tableFilterColumns = filtersOpen
    ? [...new Set([...visibleFilterKeys, "study"])]
    : [];
  if (sortByRuns)
    matchingStudies.sort(
      (a, b) => b.runs.length - a.runs.length || a.name.localeCompare(b.name),
    );
  const study =
    matchingStudies.find((item) => item.id === studyChoice) ??
    matchingStudies[0] ??
    studies.find((item) => item.id === studyChoice) ??
    studies[0];
  const studyPageCount = Math.max(
    1,
    Math.ceil(matchingStudies.length / PAGE_SIZE),
  );
  const selectedIds =
    selection && study && selection.studyId === study.id
      ? selection.ids.filter((id) => study.runs.some((run) => run.id === id))
      : (study?.runs ?? []).map((run) => run.id);
  const selectedSet = new Set(selectedIds);
  const selectTrials = (ids: string[]) => {
    if (study) setSelection({ studyId: study.id, ids });
  };
  const trialNumbers = (study?.runs ?? []).map(
    (run, index) => trialNumber(run) ?? index,
  );
  const [minTrial, maxTrial] = extent(trialNumbers);
  const trialColors = Object.fromEntries(
    (study?.runs ?? []).map((run, index) => [
      run.id,
      trialColor(
        maxTrial === minTrial
          ? 0.5
          : (trialNumbers[index] - minTrial) / (maxTrial - minTrial),
      ),
    ]),
  );
  const currentStudyPage = Math.min(studyPage, studyPageCount - 1);
  const chartMetrics = (project?.metrics ?? []).filter((item) =>
    study?.runs.some(
      (run) =>
        metricValue(run, item.key) !== undefined ||
        histories[run.id]?.some((point) => item.key in point.values),
    ),
  );
  const chartPanels = (
    chartPanelChoice ?? chartMetrics.map((item) => item.key)
  ).filter((key) => chartMetrics.some((item) => item.key === key));
  const chartSections = [
    ...new Set(
      chartPanels.map((key) =>
        key.includes("/") ? key.split("/")[0] : "Metrics",
      ),
    ),
  ];
  const chartGroups = (() => {
    const groups = new Map<string, Series>();
    for (const sourceRun of study?.runs ?? []) {
      const run = { ...sourceRun, color: trialColors[sourceRun.id] };
      const number = trialNumber(run);
      const id =
        number === undefined
          ? String(run.config.group ?? run.id)
          : `trial:${number}`;
      const existing = groups.get(id);
      if (existing) existing.runs.push(run);
      else
        groups.set(id, {
          id,
          name:
            number === undefined
              ? run.config.group
                ? `group: ${id}`
                : run.name
              : `Trial #${number}`,
          color: trialColors[run.id],
          runs: [run],
        });
    }
    return [...groups.values()];
  })();
  const selectedGroupCount = chartGroups.filter((group) =>
    group.runs.some((run) => selectedSet.has(run.id)),
  ).length;
  const panelLayout = { columns, height: panelHeight };
  const changePanelLayout = (layout: UniformPanelLayout | null) => {
    setColumns(layout?.columns ?? 2);
    setPanelHeight(layout?.height ?? DEFAULT_PANEL_HEIGHT);
  };
  const movePanel = (source: string, target: string) => {
    const section = (key: string) =>
      key.includes("/") ? key.split("/")[0] : "Metrics";
    if (section(source) !== section(target)) return;
    const next = [...chartPanels];
    const from = next.indexOf(source),
      to = next.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    next.splice(from, 1);
    next.splice(to, 0, source);
    setChartPanelChoice(next);
  };
  const chooseStudy = (id: string) => {
    setStudyChoice(id);
    setChartPanelChoice(null);
    setFocusedMetric(null);
    setShowPanelPicker(false);
  };

  if (loading)
    return (
      <div className="loading-state">
        <div className="spinner" />
        Loading tuning data…
      </div>
    );
  if (error)
    return (
      <div className="loading-state" role="alert">
        <h2>Could not load tuning data</h2>
        <p>{error}</p>
        <button className="primary" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  if (!study)
    return (
      <section className="tuner-view">
        <ViewHeader title="MagicTuner" />
        <div className="empty-state">
          No runs are available for tuning analysis.
        </div>
      </section>
    );

  if (view === "selection")
    return (
      <section
        className="tuner-view tuner-selection-view"
        aria-label="Study selection"
      >
        <ViewHeader
          className="runs-view-intro"
          title="Study selection"
          badge={<span className="count">{matchingStudies.length}</span>}
          actions={
            <div className="run-toolbar selection-toolbar">
              <FilterToggle
                open={filtersOpen}
                count={
                  Object.values(selectedFilters).filter(
                    (values) => values.length,
                  ).length
                }
                boardId="tuner-filter-board"
                onClick={() => setFiltersOpen((open) => !open)}
              />
              <button
                type="button"
                className={`toolbar-button ${sortByRuns ? "active" : ""}`}
                aria-label={`Sort studies by ${allTrials ? "trials" : "runs"}`}
                aria-pressed={sortByRuns}
                onClick={() => {
                  setSortByRuns((value) => !value);
                  setStudyPage(0);
                }}
              >
                <ArrowDownUp size={16} />
              </button>
              {project?.isSample && (
                <span className="tuner-sample">Sample data</span>
              )}
            </div>
          }
        />
        <div className="tuner-scroll">
          {filtersOpen && (
            <FilterBoard
              id="tuner-filter-board"
              label="Study filters"
              facets={facets}
              visibleKeys={visibleFilterKeys}
              selected={selectedFilters}
              shownCount={matchingStudies.length}
              totalCount={studies.length}
              countLabel="studies"
              pickerOpen={filterPickerOpen}
              dropKey={filterReorder.dropKey}
              onPickerToggle={() => setFilterPickerOpen((open) => !open)}
              onAdd={(key) => {
                setVisibleFilterKeys((keys) => [...keys, key]);
                setFilterPickerOpen(false);
              }}
              onClear={() => {
                setSelectedFilters({});
                setVisibleFilterKeys([]);
                setFilterPickerOpen(true);
                chooseStudy("");
                setStudyPage(0);
              }}
              onReset={(key) => {
                setSelectedFilters((filters) => ({ ...filters, [key]: [] }));
                chooseStudy("");
                setStudyPage(0);
              }}
              onRemove={(key) => {
                setVisibleFilterKeys((keys) =>
                  keys.filter((item) => item !== key),
                );
                setSelectedFilters((filters) => ({ ...filters, [key]: [] }));
                chooseStudy("");
                setStudyPage(0);
              }}
              onToggle={(key, option) => {
                setSelectedFilters((filters) => {
                  const values = filters[key] ?? [];
                  return {
                    ...filters,
                    [key]: values.includes(option)
                      ? values.filter((value) => value !== option)
                      : [...values, option],
                  };
                });
                chooseStudy("");
                setStudyPage(0);
              }}
              optionCount={(key, option) =>
                studies.filter(
                  (item) =>
                    matchesStudy(item, key) &&
                    (key === "study"
                      ? item.id === option
                      : completionLabel(item) === option),
                ).length
              }
              formatOption={(option) =>
                studies.find((item) => item.id === option)?.name ?? option
              }
              onDragStart={filterReorder.onDragStart}
              onDragOver={filterReorder.onDragOver}
              onDrop={filterReorder.onDrop}
              onDragEnd={filterReorder.onDragEnd}
              onDragKeyDown={filterReorder.onDragKeyDown}
            />
          )}
          <SelectionTable
            className="tuner-study-list"
            label="Tuning studies"
            pagination={
              matchingStudies.length > PAGE_SIZE ? (
                <Pagination
                  total={matchingStudies.length}
                  page={currentStudyPage}
                  pageSize={PAGE_SIZE}
                  onPageChange={setStudyPage}
                  label="studies"
                />
              ) : undefined
            }
          >
            <table>
              <thead>
                <tr>
                  <th scope="col" className="selection-choice-column">
                    Select
                  </th>
                  {filtersOpen ? (
                    tableFilterColumns.map((key) =>
                      visibleFilterKeys.includes(key) ? (
                        <FilterColumnHeader
                          key={key}
                          filterKey={key}
                          label={key === "study" ? "Study" : "Completion"}
                          selected={selectedFilters[key]}
                          formatOption={
                            key === "study"
                              ? (option) =>
                                  studies.find((item) => item.id === option)
                                    ?.name ?? option
                              : undefined
                          }
                          reorder={filterReorder}
                        />
                      ) : (
                        <th key={key} scope="col">
                          Study
                        </th>
                      ),
                    )
                  ) : (
                    <>
                      <th scope="col">Study</th>
                      <th scope="col">{allTrials ? "Trials" : "Runs"}</th>
                      <th scope="col">Completed</th>
                      <th scope="col">Parameters</th>
                      <th scope="col">Objective</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {matchingStudies
                  .slice(
                    currentStudyPage * PAGE_SIZE,
                    (currentStudyPage + 1) * PAGE_SIZE,
                  )
                  .map((item) => {
                    return (
                      <tr
                        key={item.id}
                        className={`selectable-row ${study.id === item.id ? "selection-row-active" : ""}`.trim()}
                        onClick={() => chooseStudy(item.id)}
                      >
                        <td className="selection-choice-column">
                          <SelectionRadio
                            name="tuner-selected-study"
                            label={`Select ${item.name}`}
                            checked={study.id === item.id}
                            onChange={() => chooseStudy(item.id)}
                          />
                        </td>
                        {filtersOpen ? (
                          tableFilterColumns.map((key) => (
                            <td
                              key={key}
                              className={
                                visibleFilterKeys.includes(key) &&
                                isSelectedFilterValue(
                                  selectedFilters[key],
                                  key === "study"
                                    ? item.id
                                    : completionLabel(item),
                                )
                                  ? "filter-cell-selected"
                                  : undefined
                              }
                            >
                              {key === "study"
                                ? item.name
                                : completionLabel(item)}
                            </td>
                          ))
                        ) : (
                          <>
                            <td>{item.name}</td>
                            <td>{item.runs.length}</td>
                            <td>
                              {
                                item.runs.filter(
                                  (run) => run.status === "finished",
                                ).length
                              }
                            </td>
                            <td>{item.parameters.length}</td>
                            <td>{item.objectiveKey ?? "—"}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                {!matchingStudies.length && (
                  <tr>
                    <td
                      colSpan={filtersOpen ? tableFilterColumns.length + 1 : 6}
                    >
                      No matching studies.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </SelectionTable>
        </div>
      </section>
    );

  if (view === "charts")
    return (
      <section
        className="tuner-view tuner-chart-workspace"
        aria-label="Tuning charts"
      >
        <div
          className={`tuner-overview-body ${sidebarOpen ? "" : "sidebar-hidden"}`}
        >
          {!sidebarOpen && (
            <CollapsedSidebar
              label="Open studies sidebar"
              onOpen={() => setSidebarOpen(true)}
            />
          )}
          {sidebarOpen && (
            <TunerStudiesSidebar
              studies={studies}
              selectedStudyId={study.id}
              search={studySearch}
              onSearchChange={setStudySearch}
              onChooseStudy={chooseStudy}
              onClose={() => setSidebarOpen(false)}
            />
          )}
          <div className="tuner-main">
            <ViewHeader
              title="Charts"
              actions={
                <>
                  {focusedMetric ? (
                    <>
                      <button
                        className="toolbar-button"
                        onClick={() => setFocusedMetric(null)}
                      >
                        <ChevronLeft size={16} />
                        All panels
                      </button>
                      <button
                        className="toolbar-button"
                        aria-label="Previous tuning chart"
                        disabled={chartPanels.indexOf(focusedMetric) <= 0}
                        onClick={() =>
                          setFocusedMetric(
                            chartPanels[chartPanels.indexOf(focusedMetric) - 1],
                          )
                        }
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        className="toolbar-button"
                        aria-label="Next tuning chart"
                        disabled={
                          chartPanels.indexOf(focusedMetric) >=
                          chartPanels.length - 1
                        }
                        onClick={() =>
                          setFocusedMetric(
                            chartPanels[chartPanels.indexOf(focusedMetric) + 1],
                          )
                        }
                      >
                        <ChevronRight size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <details className="tuner-group-picker">
                        <summary>
                          Trials · {selectedGroupCount}/{chartGroups.length}
                        </summary>
                        <div className="tuner-picker-options">
                          {chartGroups.map((group) => (
                            <label key={group.id}>
                              <input
                                type="checkbox"
                                checked={group.runs.every((run) =>
                                  selectedSet.has(run.id),
                                )}
                                onChange={() => {
                                  const ids = new Set(
                                    group.runs.map((run) => run.id),
                                  );
                                  selectTrials(
                                    group.runs.every((run) =>
                                      selectedSet.has(run.id),
                                    )
                                      ? selectedIds.filter((id) => !ids.has(id))
                                      : [...new Set([...selectedIds, ...ids])],
                                  );
                                }}
                              />
                              <span
                                className="run-dot"
                                style={{ background: group.color }}
                              />
                              {group.name} <small>{group.runs.length}</small>
                            </label>
                          ))}
                        </div>
                      </details>
                      <div className="tuner-panel-picker-anchor">
                        <button
                          className="primary"
                          onClick={() => setShowPanelPicker((open) => !open)}
                          aria-expanded={showPanelPicker}
                        >
                          <Plus size={16} />
                          Add panels
                        </button>
                        {showPanelPicker && (
                          <div
                            className="tuner-panel-picker"
                            role="group"
                            aria-label="Chart panels"
                          >
                            {chartMetrics.map((item) => (
                              <label key={item.key}>
                                <input
                                  type="checkbox"
                                  checked={chartPanels.includes(item.key)}
                                  onChange={() => {
                                    setChartPanelChoice(
                                      chartPanels.includes(item.key)
                                        ? chartPanels.filter(
                                            (key) => key !== item.key,
                                          )
                                        : [...chartPanels, item.key],
                                    );
                                    setFocusedMetric(null);
                                  }}
                                />
                                {item.label}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              }
            />
            <div
              className={`panels-scroll ${focusedMetric ? "panels-scroll-focused" : ""}`}
            >
              {chartSections.map((section) => {
                const keys = chartPanels.filter(
                  (key) =>
                    (key.includes("/") ? key.split("/")[0] : "Metrics") ===
                    section,
                );
                return (
                  <section
                    className={`metric-section ${focusedMetric && keys.includes(focusedMetric) ? "metric-section-focused" : ""}`}
                    key={section}
                    hidden={!!focusedMetric && !keys.includes(focusedMetric)}
                  >
                    <div className="section-heading">
                      <GripVertical size={20} />
                      <button
                        aria-label={`Toggle ${section} tuning charts`}
                        aria-expanded={!collapsedSections.includes(section)}
                        onClick={() =>
                          setCollapsedSections((previous) =>
                            previous.includes(section)
                              ? previous.filter((item) => item !== section)
                              : [...previous, section],
                          )
                        }
                      >
                        <ChevronDown
                          style={{
                            transform: collapsedSections.includes(section)
                              ? "rotate(-90deg)"
                              : undefined,
                          }}
                        />
                        <span>{section}</span>
                        <span className="count">{keys.length}</span>
                      </button>
                    </div>
                    {(!collapsedSections.includes(section) ||
                      (focusedMetric && keys.includes(focusedMetric))) && (
                      <div
                        className="chart-grid chart-grid-uniform"
                        style={{ "--panel-columns": columns } as CSSProperties}
                      >
                        {keys.map((key) => (
                          <MetricChart
                            key={`${study.id}:${key}`}
                            metric={key}
                            series={chartGroups}
                            selectedRunIds={selectedIds}
                            onSelectRuns={(ids) => {
                              const clickedIds = new Set(ids);
                              selectTrials(
                                selectedIds.length === study.runs.length
                                  ? ids
                                  : ids.every((id) => selectedSet.has(id))
                                    ? selectedIds.filter(
                                        (id) => !clickedIds.has(id),
                                      )
                                    : [...new Set([...selectedIds, ...ids])],
                              );
                            }}
                            histories={histories}
                            metrics={chartMetrics}
                            loading={historiesLoading}
                            smoothing={0}
                            scope={`tuner:${study.id}`}
                            onRemoveMetric={() => {
                              setChartPanelChoice(
                                chartPanels.filter((item) => item !== key),
                              );
                              setFocusedMetric(null);
                            }}
                            focused={focusedMetric === key}
                            suppressed={
                              !!focusedMetric && focusedMetric !== key
                            }
                            onFocusMetric={setFocusedMetric}
                            defaultSpan={12 / columns}
                            onMovePanel={movePanel}
                            uniformLayout={panelLayout}
                            onUniformLayoutChange={changePanelLayout}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
              {!chartPanels.length && (
                <div className="empty-state">
                  <h2>No chart panels</h2>
                  <p>Choose metrics from Add panels.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );

  return (
    <TunerOverview
      study={study}
      selectedIds={selectedIds}
      onSelectionChange={selectTrials}
      trialColors={trialColors}
      studies={studies}
      project={project}
      chooseStudy={chooseStudy}
      plotOrder={overviewPlotOrders[study.id] ?? []}
      onPlotOrderChange={(order) =>
        setOverviewPlotOrders((previous) => ({
          ...previous,
          [study.id]: order,
        }))
      }
      plotLayout={overviewLayout}
      onPlotLayoutChange={(layout) =>
        setOverviewLayout(
          layout ?? { columns: 2, height: DEFAULT_PANEL_HEIGHT },
        )
      }
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      studySearch={studySearch}
      onStudySearchChange={setStudySearch}
    />
  );
}
