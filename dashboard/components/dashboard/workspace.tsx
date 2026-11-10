"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowDownUp,
  Network,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Database,
  Eye,
  EyeOff,
  FlaskConical,
  GripVertical,
  List,
  Palette,
  Pin,
  Plus,
  ScanSearch,
  Settings,
  LayoutDashboard,
  Shuffle,
  Sigma,
  SlidersHorizontal,
  Table2,
  X,
} from "lucide-react";
import {
  dataAdapter,
  type MetricPoint,
  type Project,
  type Run,
  type TuningData,
} from "@/lib/data";
import {
  configValues,
  filterLabels,
  filterValue,
  optionLabel,
  matchesRunFilters,
} from "@/lib/data/run-filters";
import { compact, type Series } from "@/lib/data/chart-model";
import { downloadBlob } from "@/lib/download";
import { lazyView } from "./lazy-view";
const MetricChart = lazyView(() => import("./metric-chart"));
const Ablations = lazyView(() => import("./ablations"));
const ScalarTables = lazyView(() => import("./scalar-tables"));
import MagicAlgo from "./magic-algo";
import MagicTuner from "./magic-tuner";
const MagicData = lazyView(() => import("./magic-data"));
import ViewHeader from "./view-header";
import SelectionTable from "./selection-table";
import SidebarHeading, { CollapsedSidebar } from "./sidebar-heading";
import SidebarListHeader from "./sidebar-list-header";
import IconButton from "./icon-button";
import {
  FilterBoard,
  FilterColumnHeader,
  FilterToggle,
  isSelectedFilterValue,
  swapFilterKeys,
  useFilterReorder,
  type FilterFacet,
} from "./filter-controls";
import {
  DEFAULT_PANEL_HEIGHT,
  MAX_PANEL_COLUMNS,
  MIN_PANEL_HEIGHT,
  MAX_PANEL_HEIGHT,
  type UniformPanelLayout,
} from "@/lib/data/panel-layout";

type MenuName =
  | "group"
  | "sort"
  | "settings"
  | "panels"
  | "columns"
  | "help"
  | "project"
  | null;
type LabSection = "MagicPlot" | "MagicAlgo" | "MagicTuner" | "MagicData";
const labSections: LabSection[] = [
  "MagicPlot",
  "MagicAlgo",
  "MagicTuner",
  "MagicData",
];
export default function Dashboard() {
  const [labSection, setLabSection] = useState<LabSection>("MagicPlot");
  const [algoView, setAlgoView] = useState<"selection" | "paper">("selection");
  const [dataView, setDataView] = useState<"selection" | "viewer">("selection");
  const [tunerView, setTunerView] = useState<
    "selection" | "overview" | "charts"
  >("selection");
  const [project, setProject] = useState<Project | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [histories, setHistories] = useState<Record<string, MetricPoint[]>>({});
  const [tuningData, setTuningData] = useState<TuningData | null>(null);
  const tunerRuns = useMemo(
    () => (tuningData ? tuningData.runs : runs),
    [tuningData, runs],
  );
  const tunerHistories = useMemo(
    () => (tuningData ? tuningData.histories : histories),
    [tuningData, histories],
  );
  const [historiesLoading, setHistoriesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<
    "runs" | "workspace" | "ablations" | "tables" | "inspections"
  >("runs");
  const [groupBy, setGroupBy] = useState("group");
  const [selectedFilters, setSelectedFilters] = useState<
    Record<string, string[]>
  >({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleFilterKeys, setVisibleFilterKeys] = useState<string[]>([
    "config:algorithm",
    "config:group",
  ]);
  const [filterPickerOpen, setFilterPickerOpen] = useState(false);
  const [sort, setSort] = useState("default");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [sidebar, setSidebar] = useState(false);
  const [theme, setTheme] = useState<
    "light" | "dark" | "light-modern" | "dark-modern" | "high-contrast"
  >("light");
  const [menu, setMenu] = useState<MenuName>(null);
  const settingsDialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (menu !== "settings") return;
    const previous = document.activeElement as HTMLElement | null;
    settingsDialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, [menu]);
  const [panels, setPanels] = useState([
    "eval/mean_reward",
    "eval/mean_ep_length",
    "train/loss",
    "val/loss",
  ]);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [smoothing, setSmoothing] = useState(0);
  const [focusedMetric, setFocusedMetric] = useState<string | null>(null);
  const [columns, setColumns] = useState(2);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);
  const [panelLayoutResizing, setPanelLayoutResizing] = useState(false);
  const uniformPanelLayout = useMemo(
    () => ({ columns, height: panelHeight }),
    [columns, panelHeight],
  );
  // Keep controls responsive while chart rendering catches up to slider input.
  const chartLayout = useDeferredValue(uniformPanelLayout);
  const chartSmoothing = useDeferredValue(smoothing);
  const resizeAllPanels = useCallback(
    (layout: UniformPanelLayout | null, commit: boolean) => {
      setColumns(layout?.columns ?? 2);
      setPanelHeight(layout?.height ?? DEFAULT_PANEL_HEIGHT);
      setPanelLayoutResizing(!commit);
    },
    [],
  );
  const [selected, setSelected] = useState<Run | null>(null);
  const [detailTab, setDetailTab] = useState("Overview");
  const [page, setPage] = useState(0);
  const [saved, setSaved] = useState(false);

  const openLabSection = (section: LabSection) => {
    setLabSection(section);
    setMenu(null);
    setSelected(null);
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem("magic-lab-theme");
      // Restore the browser preference after hydration.
      /* eslint-disable react-hooks/set-state-in-effect */
      if (
        stored === "light" ||
        stored === "dark" ||
        stored === "light-modern" ||
        stored === "dark-modern" ||
        stored === "high-contrast"
      )
        setTheme(stored);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      /* Theme selection still works when storage is unavailable. */
    }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("magic-lab-theme", theme);
    } catch {
      /* Theme selection still works when storage is unavailable. */
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setHistoriesLoading(true);
      setError("");
      try {
        const [p, all, tuning] = await Promise.all([
          dataAdapter.getProject(),
          (async () => {
            const result: Run[] = [];
            let offset = 0;
            for (;;) {
              if (cancelled) return [];
              const batch = await dataAdapter.listRuns({ offset, limit: 100 });
              result.push(...batch.runs);
              offset += batch.runs.length;
              if (offset >= batch.total) return result;
              if (!batch.runs.length)
                throw new Error(
                  "The data source returned an empty page before the end of the run list.",
                );
            }
          })(),
          dataAdapter.getTuningData?.() ?? Promise.resolve(null),
        ]);
        if (cancelled) return;
        setProject(p);
        setRuns(all);
        setTuningData(tuning);
        setLoading(false);
        const entries: [string, MetricPoint[]][] = [];
        // Bound concurrency so a future remote adapter is not flooded with requests.
        for (let i = 0; i < all.length; i += 8) {
          if (cancelled) return;
          entries.push(
            ...(await Promise.all(
              all
                .slice(i, i + 8)
                .map(
                  async (r) =>
                    [r.id, await dataAdapter.getHistory(r.id)] as [
                      string,
                      MetricPoint[],
                    ],
                ),
            )),
          );
        }
        if (!cancelled) setHistories(Object.fromEntries(entries));
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Unable to load experiments.",
          );
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHistoriesLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reload]);
  useEffect(() => {
    // Restore browser-only preferences after hydration; this synchronizes external storage.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const p = JSON.parse(
        localStorage.getItem("local-workspace-v1") || "null",
      );
      if (p) {
        if (
          Array.isArray(p.panels) &&
          p.panels.every((v: unknown) => typeof v === "string")
        )
          setPanels(p.panels);
        if (
          Number.isInteger(p.columns) &&
          p.columns >= 1 &&
          p.columns <= MAX_PANEL_COLUMNS
        )
          setColumns(p.columns);
        if (
          typeof p.panelHeight === "number" &&
          Number.isFinite(p.panelHeight) &&
          p.panelHeight >= MIN_PANEL_HEIGHT &&
          p.panelHeight <= MAX_PANEL_HEIGHT
        )
          setPanelHeight(p.panelHeight);
        if (
          typeof p.smoothing === "number" &&
          p.smoothing >= 0 &&
          p.smoothing <= 0.95
        )
          setSmoothing(p.smoothing);
        const restoredFilters: Record<string, string[]> = {};
        if (
          p.selectedFilters &&
          typeof p.selectedFilters === "object" &&
          !Array.isArray(p.selectedFilters)
        )
          for (const [key, values] of Object.entries(
            p.selectedFilters as Record<string, unknown>,
          ))
            if (
              Array.isArray(values) &&
              values.every((value: unknown) => typeof value === "string")
            )
              restoredFilters[key] = values;
        setSelectedFilters(restoredFilters);
        if (
          Array.isArray(p.visibleFilterKeys) &&
          p.visibleFilterKeys.every((key: unknown) => typeof key === "string")
        )
          setVisibleFilterKeys([
            ...new Set([
              ...p.visibleFilterKeys,
              ...Object.keys(restoredFilters),
            ]),
          ]);
        else if (Object.keys(restoredFilters).length)
          setVisibleFilterKeys(Object.keys(restoredFilters));
        if (typeof p.filtersOpen === "boolean") setFiltersOpen(p.filtersOpen);
        if (["group", "algorithm", ""].includes(p.groupBy))
          setGroupBy(p.groupBy);
        if (["default", "name", "reward", "newest"].includes(p.sort))
          setSort(p.sort);
      }
    } catch {
      /* Corrupted preferences are safe to ignore. */
    }
    setSaved(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => {
    if (saved && !panelLayoutResizing) {
      try {
        localStorage.setItem(
          "local-workspace-v1",
          JSON.stringify({
            panels,
            columns,
            smoothing,
            panelHeight,
            selectedFilters,
            visibleFilterKeys,
            filtersOpen,
            groupBy,
            sort,
          }),
        );
      } catch {
        /* The dashboard also works without storage. */
      }
    }
  }, [
    panels,
    columns,
    smoothing,
    panelHeight,
    selectedFilters,
    visibleFilterKeys,
    filtersOpen,
    groupBy,
    sort,
    panelLayoutResizing,
    saved,
  ]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        setFilterPickerOpen(false);
        setSelected(null);
        setFocusedMetric(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const filterFacets = useMemo<FilterFacet[]>(() => {
    const options = new Map<string, Set<string>>([
      ["status", new Set()],
      ["tags", new Set()],
    ]);
    for (const run of runs) {
      options.get("status")!.add(JSON.stringify(run.status));
      for (const tag of run.tags) options.get("tags")!.add(JSON.stringify(tag));
      for (const [path, value] of configValues(run.config)) {
        const key = `config:${path}`;
        if (!options.has(key)) options.set(key, new Set());
        options.get(key)!.add(value);
      }
    }
    return [...options].map(([key, values]) => ({
      key,
      label:
        key === "status"
          ? "State"
          : key === "tags"
            ? "Tags"
            : (filterLabels[key.slice(7)] ?? key.slice(7).replaceAll("_", " ")),
      options: [...values].sort((a, b) =>
        optionLabel(a).localeCompare(optionLabel(b), undefined, {
          numeric: true,
        }),
      ),
    }));
  }, [runs]);
  const activeFilterCount = Object.values(selectedFilters).filter(
    (values) => values.length,
  ).length;
  const visibleFilterFacets = visibleFilterKeys.flatMap((key) =>
    filterFacets.filter((facet) => facet.key === key),
  );
  const filterColumns = filtersOpen ? visibleFilterFacets : [];
  const matchesSelectedFilters = (run: Run, except?: string) =>
    matchesRunFilters(run, selectedFilters, except);
  const filtered = useMemo(
    () =>
      runs
        .filter((r) => matchesSelectedFilters(r))
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "reward"
              ? Number(b.summary["eval/mean_reward"] ?? -Infinity) -
                Number(a.summary["eval/mean_reward"] ?? -Infinity)
              : sort === "newest"
                ? b.createdAt.localeCompare(a.createdAt)
                : 0,
        ),
    // Filter helpers are intentionally based only on the state listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runs, selectedFilters, sort],
  );
  const groups = useMemo(() => {
    const byId = new Map<string, Series>();
    for (const r of filtered) {
      const id = groupBy ? String(r.config[groupBy] ?? "Ungrouped") : r.id;
      const existing = byId.get(id);
      if (existing) existing.runs.push(r);
      else
        byId.set(id, {
          id,
          name: groupBy ? `group: ${id}` : r.name,
          color: r.color,
          runs: [r],
        });
    }
    return [...byId.values()];
  }, [filtered, groupBy]);
  const visibleSeries = useMemo(() => {
    if (!hidden.length) return groups;
    const hiddenIds = new Set(hidden);
    return groups
      .map((g) => ({ ...g, runs: g.runs.filter((r) => !hiddenIds.has(r.id)) }))
      .filter((g) => g.runs.length);
  }, [groups, hidden]);
  const tableRows = useMemo(
    () =>
      groups.flatMap((g) => [
        { key: g.id, group: groupBy ? g : null, run: g.runs[0], child: false },
        ...(groupBy && expanded.includes(g.id)
          ? g.runs.map((run) => ({
              key: `${g.id}/${run.id}`,
              group: null,
              run,
              child: true,
            }))
          : []),
      ]),
    [groups, groupBy, expanded],
  );
  const selectedSeries = useMemo<Series[]>(
    () =>
      selected
        ? [
            {
              id: selected.id,
              name: selected.name,
              color: selected.color,
              runs: [selected],
            },
          ]
        : [],
    [selected],
  );
  const removePanel = useCallback((metric: string) => {
    setPanels((previous) => previous.filter((key) => key !== metric));
    setFocusedMetric((previous) => (previous === metric ? null : previous));
  }, []);
  const movePanel = useCallback((source: string, target: string) => {
    const section = (key: string) =>
      key.includes("/") ? key.split("/")[0] : "Metrics";
    if (section(source) !== section(target)) return;
    setPanels((previous) => {
      const from = previous.indexOf(source),
        to = previous.indexOf(target);
      if (from < 0 || to < 0 || from === to) return previous;
      const next = [...previous];
      next.splice(from, 1);
      next.splice(to, 0, source);
      return next;
    });
  }, []);
  const closeDetailCharts = useCallback(() => setDetailTab("Overview"), []);
  const sections = [
    ...new Set(
      panels.map((k) => (k.includes("/") ? k.split("/")[0] : "Metrics")),
    ),
  ];
  const sectionReorder = useFilterReorder(sections, (source, target) => {
    setPanels((previous) => {
      const sectionOf = (key: string) =>
        key.includes("/") ? key.split("/")[0] : "Metrics";
      const order = [...new Set(previous.map(sectionOf))];
      return swapFilterKeys(order, source, target).flatMap((section) =>
        previous.filter((key) => sectionOf(key) === section),
      );
    });
  });
  const toggleFilterOption = (key: string, value: string) => {
    setSelectedFilters((previous) => {
      const values = previous[key] ?? [];
      const next = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
      const updated = { ...previous };
      if (next.length) updated[key] = next;
      else delete updated[key];
      return updated;
    });
    setExpanded([]);
    setPage(0);
  };
  const clearFilters = () => {
    setSelectedFilters({});
    setExpanded([]);
    setPage(0);
  };
  const removeFilter = (key: string) => {
    setVisibleFilterKeys((previous) => previous.filter((item) => item !== key));
    setFilterPickerOpen(visibleFilterKeys.length === 1);
    setSelectedFilters((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
    setExpanded([]);
    setPage(0);
  };
  const swapFilters = (source: string, target: string) =>
    setVisibleFilterKeys((previous) =>
      swapFilterKeys(previous, source, target),
    );
  const filterReorder = useFilterReorder(visibleFilterKeys, swapFilters);
  const {
    dropKey: dropFilterKey,
    onDragStart: startFilterDrag,
    onDragOver: overFilter,
    onDrop: dropFilter,
    onDragEnd: endFilterDrag,
    onDragKeyDown: moveFilterWithKeyboard,
  } = filterReorder;
  const toggleMenu = (name: MenuName) => setMenu(menu === name ? null : name);
  const toggleRuns = (items: Run[]) => {
    const allHidden = items.every((r) => hidden.includes(r.id));
    setHidden((prev) =>
      allHidden
        ? prev.filter((id) => !items.some((r) => r.id === id))
        : [...new Set([...prev, ...items.map((r) => r.id)])],
    );
  };
  const toggleExpanded = (id: string) =>
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const openRun = (run: Run) => {
    setSelected(run);
    setDetailTab("Overview");
  };
  const exportRuns = () => {
    const blob = new Blob(
      [JSON.stringify({ project, runs: filtered }, null, 2)],
      { type: "application/json" },
    );
    downloadBlob(blob, "experiment-runs.json");
  };

  const runTools = (
    <>
      <div className="run-toolbar">
        <FilterToggle
          open={filtersOpen}
          count={activeFilterCount}
          boardId="run-filter-board"
          onClick={() => {
            const wasInWorkspace = view === "workspace";
            setView("runs");
            setMenu(null);
            setFiltersOpen((open) => wasInWorkspace || !open);
            if (wasInWorkspace || !filtersOpen)
              setFilterPickerOpen(visibleFilterKeys.length === 0);
            else setFilterPickerOpen(false);
          }}
        />
        <IconButton
          label="Group runs"
          active={!!groupBy}
          onClick={() => toggleMenu("group")}
        >
          <ClipboardList />
        </IconButton>
        <IconButton
          label="Sort runs"
          active={sort !== "default"}
          onClick={() => toggleMenu("sort")}
        >
          <ArrowDownUp />
        </IconButton>
      </div>
    </>
  );
  const filterBoard = filtersOpen && (
    <FilterBoard
      id="run-filter-board"
      label="Run filters"
      facets={filterFacets}
      visibleKeys={visibleFilterKeys}
      selected={selectedFilters}
      shownCount={filtered.length}
      totalCount={runs.length}
      pickerOpen={filterPickerOpen}
      dropKey={dropFilterKey}
      onPickerToggle={() => setFilterPickerOpen((open) => !open)}
      onAdd={(key) => {
        setVisibleFilterKeys((previous) => [...previous, key]);
        setFilterPickerOpen(false);
      }}
      onClear={() => {
        clearFilters();
        setVisibleFilterKeys([]);
        setFilterPickerOpen(true);
      }}
      onReset={(key) => {
        setSelectedFilters((previous) => {
          const next = { ...previous };
          delete next[key];
          return next;
        });
        setExpanded([]);
        setPage(0);
      }}
      onRemove={removeFilter}
      onToggle={toggleFilterOption}
      optionCount={(key, option) => {
        const eligible = runs.filter((run) => matchesSelectedFilters(run, key));
        return eligible.filter((run) => filterValue(run, key).includes(option))
          .length;
      }}
      onDragStart={startFilterDrag}
      onDragOver={overFilter}
      onDrop={dropFilter}
      onDragEnd={endFilterDrag}
      onDragKeyDown={moveFilterWithKeyboard}
    />
  );
  const popover = menu && !["help", "project"].includes(menu) && (
    <>
      <div className="menu-dismiss" onClick={() => setMenu(null)} />
      <div
        className={`popover workspace-popover menu-${menu} ${view === "runs" && (menu === "group" || menu === "sort") ? "runs-popover" : ""}`}
        role="dialog"
        ref={menu === "settings" ? settingsDialog : undefined}
        aria-modal={menu === "settings" ? true : undefined}
        aria-label={`${menu} options`}
        onKeyDown={(event) => {
          if (event.key === "Escape") setMenu(null);
          if (menu !== "settings" || event.key !== "Tab") return;
          const controls = [
            ...(settingsDialog.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
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
        <div className="popover-heading">
          {
            (
              {
                group: "Group by",
                sort: "Sort runs",
                settings: "Panel settings",
                panels: "Add panels",
                columns: "Table columns",
              } as Record<string, string>
            )[menu]
          }
          <button aria-label="Close menu" onClick={() => setMenu(null)}>
            <X size={16} />
          </button>
        </div>
        {menu === "group" &&
          [
            ["group", "config.group"],
            ["algorithm", "config.algorithm"],
            ["", "No grouping"],
          ].map(([key, label]) => (
            <button
              className={groupBy === key ? "selected-option" : ""}
              key={key}
              onClick={() => {
                setGroupBy(key);
                setExpanded([]);
                setPage(0);
                setMenu(null);
              }}
            >
              {label}
            </button>
          ))}
        {menu === "sort" &&
          [
            ["default", "Default order"],
            ["name", "Name · A to Z"],
            ["newest", "Created · newest first"],
            ["reward", "Mean reward · highest first"],
          ].map(([key, label]) => (
            <button
              className={sort === key ? "selected-option" : ""}
              key={key}
              onClick={() => {
                setSort(key);
                setMenu(null);
              }}
            >
              {label}
            </button>
          ))}
        {menu === "settings" && (
          <div className="panel-settings-body">
            <p className="muted">Layout applies to all workspace charts.</p>
            <label>
              Columns
              <select
                aria-label="Columns"
                value={columns}
                onChange={(e) => setColumns(+e.target.value)}
              >
                {Array.from(
                  { length: MAX_PANEL_COLUMNS },
                  (_, index) => index + 1,
                ).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Panel height <b>{panelHeight} px</b>
              <input
                aria-label="Panel height"
                type="range"
                min={MIN_PANEL_HEIGHT}
                max={MAX_PANEL_HEIGHT}
                step="1"
                value={panelHeight}
                onChange={(event) => setPanelHeight(+event.target.value)}
              />
            </label>
            <p className="muted">Narrow screens use one column.</p>
            <label>
              Smoothing <b>{smoothing.toFixed(2)}</b>
              <input
                aria-label="Smoothing"
                type="range"
                min="0"
                max="0.95"
                step="0.01"
                value={smoothing}
                onChange={(e) => setSmoothing(+e.target.value)}
              />
            </label>
            <p className="muted">
              Default smoothing strength. Individual chart settings take
              precedence. Zero keeps the original curve.
            </p>
            <div className="panel-settings-actions">
              <button
                className="toolbar-button"
                disabled={
                  !sections.length ||
                  !sections.some((s) => collapsed.includes(s))
                }
                onClick={() => setCollapsed([])}
              >
                Expand all
              </button>
              <button
                className="toolbar-button"
                disabled={
                  !sections.length ||
                  sections.every((s) => collapsed.includes(s)) ||
                  !!focusedMetric
                }
                onClick={() => setCollapsed(sections)}
              >
                Collapse all
              </button>
            </div>
            <button
              className="toolbar-button"
              disabled={
                columns === 2 &&
                panelHeight === DEFAULT_PANEL_HEIGHT &&
                smoothing === 0
              }
              onClick={() => {
                resizeAllPanels(null, true);
                setSmoothing(0);
              }}
            >
              Reset layout and smoothing
            </button>
          </div>
        )}
        {menu === "panels" &&
          project?.metrics.map((m) => (
            <label className="check-option" key={m.key}>
              <input
                type="checkbox"
                checked={panels.includes(m.key)}
                onChange={() =>
                  setPanels((prev) =>
                    prev.includes(m.key)
                      ? prev.filter((x) => x !== m.key)
                      : [...prev, m.key],
                  )
                }
              />
              {m.label}
            </label>
          ))}
        {menu === "columns" && (
          <>
            <p className="muted">
              While Filter is on, table columns follow the displayed filters.
              Drag a filter or column handle to swap their order. Close Filter
              to show general run information.
            </p>
            <button
              onClick={() => {
                setView("runs");
                setMenu(null);
              }}
            >
              Open full runs table
            </button>
          </>
        )}
      </div>
    </>
  );

  return (
    <main className="dashboard-shell">
      <header className="global-header">
        <div className="brand">
          <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22 19.2727C22 20.779 20.779 22 19.2727 22H14.7273C13.221 22 12 20.779 12 19.2727V12H19.2727C20.779 12 22 13.221 22 14.7273V19.2727Z"
              fill="#68C4FF"
            />
            <path
              d="M20 2C21.1046 2 22 2.89543 22 4V7C22 8.10457 21.1046 9 20 9H17C15.8954 9 15 8.10457 15 7V4C15 2.89543 15.8954 2 17 2H20Z"
              fill="#0C79D8"
            />
            <path
              d="M7 15C8.10457 15 9 15.8954 9 17V20C9 21.1046 8.10457 22 7 22H4C2.89543 22 2 21.1046 2 20V17C2 15.8954 2.89543 15 4 15H7Z"
              fill="#0C79D8"
            />
            <path
              d="M12 12H4.72727C3.22104 12 2 10.779 2 9.27273V4.72727C2 3.22104 3.22104 2 4.72727 2H9.27273C10.779 2 12 3.22104 12 4.72727V12Z"
              fill="#2E9EFF"
            />
          </svg>
          <strong>MagicLab</strong>
        </div>
        <nav className="lab-sections" aria-label="MagicLab sections">
          {labSections.map((section) => (
            <button
              className="lab-section-tab"
              key={section}
              aria-current={labSection === section ? "page" : undefined}
              onClick={() => openLabSection(section)}
            >
              {section === "MagicPlot" ? (
                <ChartNoAxesCombined aria-hidden="true" />
              ) : section === "MagicAlgo" ? (
                <Network aria-hidden="true" />
              ) : section === "MagicData" ? (
                <Database aria-hidden="true" />
              ) : (
                <SlidersHorizontal aria-hidden="true" />
              )}
              {section}
            </button>
          ))}
        </nav>
        <label className="theme-picker">
          <Palette size={17} aria-hidden="true" />
          <span className="sr-only">Theme</span>
          <select
            aria-label="Dashboard theme"
            value={theme}
            onChange={(event) => setTheme(event.target.value as typeof theme)}
          >
            <option value="light">Light+</option>
            <option value="dark">Dark+</option>
            <option value="light-modern">Light Modern</option>
            <option value="dark-modern">Dark Modern</option>
            <option value="high-contrast">High Contrast</option>
          </select>
        </label>
      </header>
      {labSection === "MagicPlot" && (
        <nav className="navigation-rail" aria-label="MagicPlot navigation">
          <IconButton
            label="Runs selection"
            active={labSection === "MagicPlot" && view === "runs"}
            onClick={() => {
              setLabSection("MagicPlot");
              setView("runs");
            }}
          >
            <List />
          </IconButton>
          <IconButton
            label="Workspace"
            active={labSection === "MagicPlot" && view === "workspace"}
            onClick={() => {
              setLabSection("MagicPlot");
              setView("workspace");
            }}
          >
            <ChartNoAxesCombined />
          </IconButton>
          <IconButton
            label="Ablations"
            active={labSection === "MagicPlot" && view === "ablations"}
            onClick={() => {
              setLabSection("MagicPlot");
              setView("ablations");
            }}
          >
            <Shuffle />
          </IconButton>
          <IconButton
            label="Tables"
            active={labSection === "MagicPlot" && view === "tables"}
            onClick={() => {
              setLabSection("MagicPlot");
              setView("tables");
            }}
          >
            <Table2 />
          </IconButton>
          <IconButton
            label="Inspections"
            active={labSection === "MagicPlot" && view === "inspections"}
            onClick={() => {
              setLabSection("MagicPlot");
              setView("inspections");
            }}
          >
            <ScanSearch />
          </IconButton>
        </nav>
      )}
      {labSection === "MagicAlgo" && (
        <nav className="navigation-rail" aria-label="MagicAlgo navigation">
          <IconButton
            label="Algorithm selection"
            active={algoView === "selection"}
            onClick={() => setAlgoView("selection")}
          >
            <List />
          </IconButton>
          <IconButton
            label="Mathematical algorithm"
            active={algoView === "paper"}
            onClick={() => setAlgoView("paper")}
          >
            <Sigma />
          </IconButton>
        </nav>
      )}
      {labSection === "MagicTuner" && (
        <nav className="navigation-rail" aria-label="MagicTuner navigation">
          <IconButton
            label="Study selection"
            active={tunerView === "selection"}
            onClick={() => setTunerView("selection")}
          >
            <List />
          </IconButton>
          <IconButton
            label="Study overview"
            active={tunerView === "overview"}
            onClick={() => setTunerView("overview")}
          >
            <LayoutDashboard />
          </IconButton>
          <IconButton
            label="All charts"
            active={tunerView === "charts"}
            onClick={() => setTunerView("charts")}
          >
            <ChartNoAxesCombined />
          </IconButton>
        </nav>
      )}
      {labSection === "MagicData" && (
        <nav className="navigation-rail" aria-label="MagicData navigation">
          <IconButton
            label="Data selection"
            active={dataView === "selection"}
            onClick={() => setDataView("selection")}
          >
            <List />
          </IconButton>
          <IconButton
            label="Data viewer"
            active={dataView === "viewer"}
            onClick={() => setDataView("viewer")}
          >
            <Table2 />
          </IconButton>
        </nav>
      )}
      {labSection === "MagicData" ? (
        <MagicData view={dataView} onViewChange={setDataView} />
      ) : labSection === "MagicAlgo" ? (
        <MagicAlgo
          runs={runs}
          loading={loading}
          error={error}
          sample={project?.isSample ?? false}
          view={algoView}
          onViewChange={setAlgoView}
        />
      ) : labSection === "MagicTuner" ? (
        <MagicTuner
          runs={tunerRuns}
          project={project}
          histories={tunerHistories}
          historiesLoading={historiesLoading && !tuningData}
          definitions={tuningData?.studies}
          loading={loading}
          error={error}
          onRetry={() => setReload((value) => value + 1)}
          view={tunerView}
        />
      ) : loading ? (
        <div className="loading-state">
          <div className="spinner" />
          Loading workspace…
        </div>
      ) : error ? (
        <div className="loading-state" role="alert">
          <h2>Could not load the workspace</h2>
          <p>{error}</p>
          <button className="primary" onClick={() => setReload((x) => x + 1)}>
            Retry
          </button>
        </div>
      ) : (
        <div
          className={`workspace-body ${view === "workspace" && !sidebar ? "sidebar-hidden" : ""} ${view !== "workspace" ? "table-view" : ""}`}
        >
          {view === "workspace" && !sidebar && (
            <CollapsedSidebar
              label="Open runs sidebar"
              onOpen={() => setSidebar(true)}
            />
          )}
          {view === "workspace" && sidebar && (
            <aside className="runs-sidebar">
              <SidebarHeading
                title="Runs"
                count={runs.length}
                closeLabel="Close runs sidebar"
                onClose={() => setSidebar(false)}
              />
              <div className="runs-controls">{runTools}</div>
              <SidebarListHeader
                label="NAME"
                count={filtered.length}
                leading={
                  <button
                    aria-label="Toggle all visible runs"
                    onClick={() => toggleRuns(filtered)}
                  >
                    <Eye />
                  </button>
                }
              />
              <div className="run-list">
                {groups.slice(page * 12, page * 12 + 12).map((g) => (
                  <div key={g.id}>
                    <div className="group-row">
                      <button
                        className="visibility"
                        aria-label={`Toggle visibility ${g.id}`}
                        aria-pressed={
                          !g.runs.every((r) => hidden.includes(r.id))
                        }
                        onClick={() => toggleRuns(g.runs)}
                      >
                        {g.runs.every((r) => hidden.includes(r.id)) ? (
                          <EyeOff />
                        ) : (
                          <Eye />
                        )}
                      </button>
                      <span
                        className="run-dot"
                        style={{ background: g.color }}
                      />
                      <button
                        className="group-name"
                        aria-expanded={expanded.includes(g.id)}
                        onClick={() =>
                          groupBy ? toggleExpanded(g.id) : openRun(g.runs[0])
                        }
                      >
                        {groupBy &&
                          (expanded.includes(g.id) ? (
                            <ChevronDown />
                          ) : (
                            <ChevronRight />
                          ))}
                        <span>{groupBy ? `Group: ${g.id}` : g.name}</span>
                      </button>
                      {groupBy && (
                        <span className="group-count">{g.runs.length}</span>
                      )}
                    </div>
                    {groupBy &&
                      expanded.includes(g.id) &&
                      g.runs.map((r) => (
                        <div className="child-run" key={r.id}>
                          <button
                            aria-label={`Toggle visibility ${r.name}`}
                            onClick={() => toggleRuns([r])}
                          >
                            {hidden.includes(r.id) ? <EyeOff /> : <Eye />}
                          </button>
                          <button
                            className="run-link"
                            onClick={() => openRun(r)}
                          >
                            <span className={`status-dot ${r.status}`} />
                            {r.name}
                          </button>
                        </div>
                      ))}
                  </div>
                ))}
                {!groups.length && (
                  <div className="empty-state">
                    No runs match your filters.
                    <button
                      onClick={() => {
                        clearFilters();
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
              <div className="pagination">
                <span>
                  {groups.length ? page * 12 + 1 : 0}–
                  {Math.min((page + 1) * 12, groups.length)}
                </span>
                <ChevronDown size={16} />
                <span>of {groups.length}</span>
                <button
                  aria-label="Previous groups"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft />
                </button>
                <button
                  aria-label="Next groups"
                  disabled={(page + 1) * 12 >= groups.length}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight />
                </button>
              </div>
            </aside>
          )}
          {view === "workspace" ? (
            <section className="panels-area" aria-label="Metric panels">
              <ViewHeader
                title="Workspace"
                actions={
                  focusedMetric ? (
                    <>
                      <button
                        className="toolbar-button"
                        onClick={() => setFocusedMetric(null)}
                      >
                        <ChevronLeft size={17} />
                        All panels
                      </button>
                      <button
                        className="toolbar-button"
                        aria-label="Previous panel"
                        disabled={panels.indexOf(focusedMetric) <= 0}
                        onClick={() =>
                          setFocusedMetric(
                            panels[panels.indexOf(focusedMetric) - 1],
                          )
                        }
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>
                      <button
                        className="toolbar-button"
                        aria-label="Next panel"
                        disabled={
                          panels.indexOf(focusedMetric) >= panels.length - 1
                        }
                        onClick={() =>
                          setFocusedMetric(
                            panels[panels.indexOf(focusedMetric) + 1],
                          )
                        }
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <IconButton
                        label="Panel settings"
                        onClick={() => toggleMenu("settings")}
                      >
                        <Settings />
                      </IconButton>
                      <button
                        className="primary"
                        onClick={() => toggleMenu("panels")}
                      >
                        <Plus />
                        Add panels
                      </button>
                    </>
                  )
                }
              />
              <div
                className={`panels-scroll ${focusedMetric ? "panels-scroll-focused" : ""}`}
              >
                {sections.map((section) => {
                  const keys = panels.filter(
                    (k) =>
                      (k.includes("/") ? k.split("/")[0] : "Metrics") ===
                      section,
                  );
                  return (
                    <section
                      className={`metric-section ${focusedMetric && keys.includes(focusedMetric) ? "metric-section-focused" : ""}`}
                      key={section}
                      hidden={!!focusedMetric && !keys.includes(focusedMetric)}
                    >
                      <div
                        className={`section-heading ${sectionReorder.dropKey === section ? "section-drop-target" : ""}`}
                        onDragOver={(event) =>
                          sectionReorder.onDragOver(event, section)
                        }
                        onDrop={(event) =>
                          sectionReorder.onDrop(event, section)
                        }
                      >
                        <button
                          type="button"
                          className="filter-drag-handle"
                          aria-label={`Reorder ${section} section`}
                          title="Drag to swap sections; use arrow keys to move"
                          draggable
                          onDragStart={(event) =>
                            sectionReorder.onDragStart(event, section)
                          }
                          onDragEnd={sectionReorder.onDragEnd}
                          onKeyDown={(event) =>
                            sectionReorder.onDragKeyDown(event, section)
                          }
                        >
                          <GripVertical size={20} />
                        </button>
                        <button
                          aria-label={`Toggle ${section} section`}
                          aria-expanded={!collapsed.includes(section)}
                          onClick={() =>
                            setCollapsed((p) =>
                              p.includes(section)
                                ? p.filter((x) => x !== section)
                                : [...p, section],
                            )
                          }
                        >
                          {collapsed.includes(section) ? (
                            <ChevronRight />
                          ) : (
                            <ChevronDown />
                          )}
                          <span>{section}</span>
                          <span className="count">{keys.length}</span>
                        </button>
                        <div className="spacer" />
                        <IconButton
                          label={`Move ${section} section to top`}
                          onClick={() =>
                            setPanels([
                              ...keys,
                              ...panels.filter((k) => !keys.includes(k)),
                            ])
                          }
                        >
                          <Pin />
                        </IconButton>
                        <IconButton
                          label={`Settings for ${section}`}
                          onClick={() => toggleMenu("settings")}
                        >
                          <Settings />
                        </IconButton>
                      </div>
                      {(!collapsed.includes(section) ||
                        (!!focusedMetric && keys.includes(focusedMetric))) && (
                        <div
                          className="chart-grid chart-grid-uniform"
                          style={
                            {
                              "--panel-columns": chartLayout.columns,
                            } as CSSProperties
                          }
                        >
                          {keys.map((key) => (
                            <MetricChart
                              key={key}
                              metric={key}
                              series={visibleSeries}
                              histories={histories}
                              metrics={project?.metrics}
                              loading={historiesLoading}
                              smoothing={chartSmoothing}
                              onRemoveMetric={removePanel}
                              focused={focusedMetric === key}
                              suppressed={
                                !!focusedMetric && focusedMetric !== key
                              }
                              onFocusMetric={setFocusedMetric}
                              defaultSpan={12 / chartLayout.columns}
                              onMovePanel={movePanel}
                              uniformLayout={chartLayout}
                              onUniformLayoutChange={resizeAllPanels}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
                {!sections.length && (
                  <div className="empty-state">
                    <h2>No panels to display</h2>
                    <p>Add a metric panel to get started.</p>
                    <button
                      className="primary"
                      onClick={() => {
                        setMenu("panels");
                      }}
                    >
                      Add panels
                    </button>
                  </div>
                )}
              </div>
            </section>
          ) : view === "ablations" ? (
            <Ablations
              runs={filtered}
              histories={histories}
              project={project}
              facets={filterFacets}
              loading={historiesLoading}
              smoothing={chartSmoothing}
            />
          ) : view === "tables" ? (
            <ScalarTables
              runs={filtered}
              project={project}
              onOpenRun={openRun}
            />
          ) : view === "inspections" ? (
            <section className="inspections-view">
              <ViewHeader title="Inspections" />
            </section>
          ) : (
            <section className="full-table">
              <ViewHeader
                title="Runs selection"
                badge={<span className="count">{filtered.length}</span>}
                className="runs-view-intro"
                actions={
                  <>
                    {runTools}
                    <button className="toolbar-button" onClick={exportRuns}>
                      <Download />
                      Export JSON
                    </button>
                  </>
                }
              />
              {filterBoard}
              <SelectionTable
                className="selection-table-runs"
                label={
                  filtersOpen ? "Runs by displayed filters" : "Run information"
                }
              >
                <table
                  aria-label={
                    filtersOpen
                      ? "Runs by displayed filters"
                      : "Run information"
                  }
                >
                  <thead>
                    <tr>
                      <th>
                        <button
                          aria-label="Toggle all visible runs"
                          onClick={() => toggleRuns(filtered)}
                        >
                          <Eye size={18} />
                        </button>
                      </th>
                      <th>
                        <button onClick={() => setSort("name")}>
                          NAME{" "}
                          <span className="count">
                            {groupBy
                              ? `${groups.length} groups · ${filtered.length} runs`
                              : `${filtered.length} runs`}
                          </span>
                        </button>
                      </th>
                      {filtersOpen ? (
                        filterColumns.map((facet) => (
                          <FilterColumnHeader
                            key={facet.key}
                            filterKey={facet.key}
                            label={facet.label}
                            selected={selectedFilters[facet.key]}
                            reorder={filterReorder}
                          />
                        ))
                      ) : (
                        <>
                          <th>STATE</th>
                          <th>TAGS</th>
                          <th>CREATED</th>
                          <th>
                            <button onClick={() => setSort("reward")}>
                              eval/mean_reward <ArrowDownUp size={14} />
                            </button>
                          </th>
                          <th>RUNTIME</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(({ key, group: g, run: r, child }) => (
                      <tr key={key} className={child ? "table-child" : ""}>
                        <td>
                          <button
                            aria-label={`Toggle table visibility ${g?.id ?? r.name}`}
                            onClick={() => toggleRuns(g?.runs ?? [r])}
                          >
                            {(g?.runs ?? [r]).every((item) =>
                              hidden.includes(item.id),
                            ) ? (
                              <EyeOff size={17} />
                            ) : (
                              <Eye size={17} />
                            )}
                          </button>
                        </td>
                        <td>
                          <button
                            className="table-run-name"
                            aria-expanded={
                              g ? expanded.includes(g.id) : undefined
                            }
                            onClick={() =>
                              g ? toggleExpanded(g.id) : openRun(r)
                            }
                          >
                            <span
                              className="run-dot"
                              style={{ background: r.color }}
                            />
                            {g &&
                              (expanded.includes(g.id) ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              ))}
                            {g ? `Group: ${g.id}` : r.name}
                            {g && (
                              <span className="group-count">
                                {g.runs.length}
                              </span>
                            )}
                          </button>
                        </td>
                        {filtersOpen ? (
                          filterColumns.map((facet) => {
                            const rawValues = [
                              ...new Set(
                                (g?.runs ?? [r]).flatMap((run) =>
                                  filterValue(run, facet.key),
                                ),
                              ),
                            ];
                            const values = rawValues.map(optionLabel);
                            return (
                              <td
                                key={facet.key}
                                className={
                                  isSelectedFilterValue(
                                    selectedFilters[facet.key],
                                    rawValues,
                                  )
                                    ? "filter-cell-selected"
                                    : undefined
                                }
                              >
                                {values.length
                                  ? facet.key === "tags"
                                    ? values.map((value) => (
                                        <span className="tag" key={value}>
                                          {value}
                                        </span>
                                      ))
                                    : facet.key === "status"
                                      ? values.map((value) => (
                                          <span
                                            className={`status ${value}`}
                                            key={value}
                                          >
                                            {value}
                                          </span>
                                        ))
                                      : values.join(", ")
                                  : "\u2014"}
                              </td>
                            );
                          })
                        ) : (
                          <>
                            <td>
                              {[
                                ...new Set(
                                  (g?.runs ?? [r]).map((item) => item.status),
                                ),
                              ].map((state) => (
                                <span key={state} className={`status ${state}`}>
                                  {state}
                                </span>
                              ))}
                            </td>
                            <td>
                              {r.tags.slice(0, 2).map((tag) => (
                                <span className="tag" key={tag}>
                                  {tag}
                                </span>
                              ))}
                            </td>
                            <td>
                              {new Date(r.createdAt).toLocaleDateString()}
                            </td>
                            <td>
                              {g
                                ? "\u2014"
                                : typeof r.summary["eval/mean_reward"] ===
                                    "number"
                                  ? compact(r.summary["eval/mean_reward"])
                                  : "\u2014"}
                            </td>
                            <td>
                              {g
                                ? "\u2014"
                                : `${Math.floor(r.durationSeconds / 60)}m ${r.durationSeconds % 60}s`}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && (
                  <div className="empty-state">No matching runs</div>
                )}
              </SelectionTable>
            </section>
          )}
        </div>
      )}
      {labSection === "MagicPlot" && popover}
      {labSection === "MagicPlot" &&
        (menu === "help" || menu === "project") && (
          <div className="modal-backdrop" onClick={() => setMenu(null)}>
            <section
              role="dialog"
              aria-modal="true"
              aria-label={
                menu === "help" ? "Dashboard help" : "Project details"
              }
              className="info-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
                aria-label="Close dialog"
                onClick={() => setMenu(null)}
              >
                <X />
              </button>
              <span className="modal-icon">
                <FlaskConical />
              </span>
              <h2>
                {menu === "help"
                  ? "Your local experiment workspace"
                  : project?.name}
              </h2>
              {menu === "help" ? (
                <>
                  <p>
                    Filter runs, group by configuration, and use the eye
                    controls to compare selected experiments.
                  </p>
                  <p>
                    Open a run to inspect its configuration, summary and
                    history. Add metric panels and adjust smoothing from panel
                    settings.
                  </p>
                  <p>
                    Filters, grouping, sorting, panel layout, and smoothing are
                    saved in this browser. Press Escape to close dialogs.
                  </p>
                </>
              ) : (
                <>
                  <p>{project?.description}</p>
                  <dl>
                    <dt>Source</dt>
                    <dd>
                      {project?.isSample
                        ? "Deterministic synthetic sample data"
                        : "Connected data adapter"}
                    </dd>
                    <dt>Runs</dt>
                    <dd>{runs.length}</dd>
                    <dt>Metrics</dt>
                    <dd>{project?.metrics.length}</dd>
                  </dl>
                  <p>
                    No training job is connected. This local interface reads
                    through a replaceable data adapter.
                  </p>
                </>
              )}
            </section>
          </div>
        )}
      {labSection === "MagicPlot" && selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="run-detail"
            role="dialog"
            aria-modal="true"
            aria-label={`Run ${selected.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="detail-heading">
              <span
                className="run-dot"
                style={{ background: selected.color }}
              />
              <h2>{selected.name}</h2>
              <span className={`status ${selected.status}`}>
                {selected.status}
              </span>
              <div className="spacer" />
              <IconButton
                label="Close run details"
                onClick={() => setSelected(null)}
              >
                <X />
              </IconButton>
            </div>
            <div className="detail-tabs" role="tablist">
              {["Overview", "Config", "Summary", "Charts"].map((t) => (
                <button
                  role="tab"
                  aria-selected={detailTab === t}
                  className={detailTab === t ? "active" : ""}
                  key={t}
                  onClick={() => setDetailTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="detail-content">
              {detailTab === "Overview" ? (
                <>
                  <h3>Run overview</h3>
                  <dl>
                    <dt>ID</dt>
                    <dd>{selected.id}</dd>
                    <dt>Created</dt>
                    <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
                    <dt>Runtime</dt>
                    <dd>{Math.round(selected.durationSeconds / 60)} minutes</dd>
                    <dt>Tags</dt>
                    <dd>
                      {selected.tags.map((t) => (
                        <span className="tag" key={t}>
                          {t}
                        </span>
                      ))}
                    </dd>
                    <dt>Group</dt>
                    <dd>{String(selected.config.group ?? "Ungrouped")}</dd>
                  </dl>
                  <h3>Latest metrics</h3>
                  <div className="summary-cards">
                    {project?.metrics.slice(0, 3).map((m) => (
                      <div key={m.key}>
                        <span>{m.label}</span>
                        <strong>
                          {typeof selected.summary[m.key] === "number"
                            ? compact(selected.summary[m.key] as number)
                            : "—"}
                        </strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : detailTab === "Charts" ? (
                <div
                  className="chart-grid chart-grid-uniform"
                  style={
                    { "--panel-columns": chartLayout.columns } as CSSProperties
                  }
                >
                  {project?.metrics.slice(0, 2).map((m) => (
                    <MetricChart
                      key={m.key}
                      metric={m.key}
                      series={selectedSeries}
                      histories={histories}
                      metrics={project?.metrics}
                      scope={selected.id}
                      loading={historiesLoading}
                      smoothing={chartSmoothing}
                      onRemoveMetric={closeDetailCharts}
                      uniformLayout={chartLayout}
                      onUniformLayoutChange={resizeAllPanels}
                    />
                  ))}
                </div>
              ) : (
                <table className="key-value-table">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      detailTab === "Config"
                        ? selected.config
                        : selected.summary,
                    ).map(([k, v]) => (
                      <tr key={k}>
                        <td>{k}</td>
                        <td>
                          <code>
                            {typeof v === "object"
                              ? JSON.stringify(v)
                              : String(v)}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
