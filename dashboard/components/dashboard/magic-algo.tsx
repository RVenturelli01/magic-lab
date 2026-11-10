"use client";
import Pagination from "./pagination";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, GitCompareArrows, X } from "lucide-react";
import type { Run } from "@/lib/data";
import { optionLabel } from "@/lib/data/run-filters";
import {
  algorithmForRun,
  algorithmVariants,
  filterAlgorithmVariants,
  variantKey,
  type AlgorithmFacet,
  type AlgorithmVariant,
} from "@/lib/algorithms/catalog";
import { formulations } from "@/lib/algorithms/formulations";
import {
  defaultAlgorithmPreferences,
  parseAlgorithmPreferences,
} from "@/lib/algorithms/preferences";
import {
  FilterBoard,
  FilterColumnHeader,
  FilterToggle,
  isSelectedFilterValue,
  swapFilterKeys,
  useFilterReorder,
  type FilterFacet,
} from "./filter-controls";
import { lazyView } from "./lazy-view";
const AlgorithmDocument = lazyView(() => import("./algorithm-document"));
import IconButton from "./icon-button";
import ViewHeader from "./view-header";
import SelectionTable from "./selection-table";
import SelectionRadio from "./selection-radio";
import SidebarHeading, { CollapsedSidebar } from "./sidebar-heading";
import SidebarListHeader from "./sidebar-list-header";

const storageKey = "magic-algo-v3";
const pageSize = 50;
const versionLabel = (version: string | null) => version ?? "Unversioned";

export default function MagicAlgo({
  runs,
  loading,
  error,
  sample,
  view,
  onViewChange,
}: {
  runs: Run[];
  loading: boolean;
  error: string;
  sample: boolean;
  view: "selection" | "paper";
  onViewChange: (view: "selection" | "paper") => void;
}) {
  const [prefs, setPrefs] = useState(defaultAlgorithmPreferences);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [filterPickerOpen, setFilterPickerOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [page, setPage] = useState(0);
  const legacySelectedRunId = useRef<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setPrefs(parseAlgorithmPreferences(JSON.parse(stored)));
      } else {
        const legacy = localStorage.getItem("magic-algo-v2");
        if (legacy) {
          const old = JSON.parse(legacy) as Record<string, unknown>;
          const oldFilters =
            old.filters && typeof old.filters === "object"
              ? (old.filters as Record<string, unknown>)
              : {};
          const values = (key: string) =>
            Array.isArray(oldFilters[key])
              ? oldFilters[key]
                  .filter((value): value is string => typeof value === "string")
                  .map(optionLabel)
              : [];
          const saved = parseAlgorithmPreferences(old);
          setPrefs({
            ...saved,
            filters: {
              algorithm: values("algo:algorithm"),
              version: values("algo:version"),
            },
            visibleFilterKeys: Array.isArray(old.visibleFilterKeys)
              ? old.visibleFilterKeys
                  .map((key) =>
                    key === "algo:algorithm"
                      ? "algorithm"
                      : key === "algo:version"
                        ? "version"
                        : null,
                  )
                  .filter((key): key is AlgorithmFacet => key !== null)
              : ["algorithm", "version"],
          });
          legacySelectedRunId.current =
            typeof old.selectedRunId === "string" ? old.selectedRunId : null;
        }
      }
    } catch {
      setStorageError("Saved MagicAlgo preferences could not be read.");
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => {
    if (!legacySelectedRunId.current || !runs.length) return;
    const run = runs.find((item) => item.id === legacySelectedRunId.current);
    legacySelectedRunId.current = null;
    const identity = run && algorithmForRun(run);
    if (identity)
      setPrefs((current) => ({
        ...current,
        selectedVariantKey: variantKey(identity),
      }));
  }, [runs]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(prefs));
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageError(
        "MagicAlgo preferences could not be saved in this browser.",
      );
    }
  }, [prefs, ready]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFilterPickerOpen(false);
        setSortOpen(false);
        setPrefs((current) =>
          current.filterOpen ? { ...current, filterOpen: false } : current,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const variants = useMemo(() => algorithmVariants(runs), [runs]);
  const facets = useMemo<FilterFacet[]>(
    () => [
      {
        key: "algorithm",
        label: "Algorithm",
        options: [...new Set(variants.map((variant) => variant.name))],
      },
      {
        key: "version",
        label: "Version",
        options: [
          ...new Set(variants.map((variant) => versionLabel(variant.version))),
        ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      },
    ],
    [variants],
  );
  const visible = useMemo(
    () => filterAlgorithmVariants(variants, prefs),
    [variants, prefs],
  );
  const selected =
    visible.find(
      (variant) => variantKey(variant) === prefs.selectedVariantKey,
    ) ?? visible[0];
  const selectedKey = selected ? variantKey(selected) : "";
  const formulation = selectedKey ? formulations[selectedKey] : undefined;
  const comparison = variants.find(
    (variant) =>
      variantKey(variant) === prefs.comparisonVariantKey &&
      variantKey(variant) !== selectedKey,
  );
  const comparisonFormulation = comparison
    ? formulations[variantKey(comparison)]
    : undefined;
  const activeFilterCount = Object.values(prefs.filters).filter(
    (values) => values.length,
  ).length;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageVariants = visible.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );

  const selectVariant = (variant: AlgorithmVariant) => {
    setPrefs((current) => ({
      ...current,
      selectedVariantKey: variantKey(variant),
    }));
    setPage(
      Math.floor(
        visible.findIndex((item) => variantKey(item) === variantKey(variant)) /
          pageSize,
      ),
    );
  };
  const compareVariant = (variant: AlgorithmVariant) => {
    setPrefs((current) => ({
      ...current,
      selectedVariantKey: selectedKey,
      comparisonVariantKey: variantKey(variant),
    }));
    onViewChange("paper");
  };
  const compareButton = (variant: AlgorithmVariant) => (
    <IconButton
      label={`Compare ${variant.name} ${versionLabel(variant.version)} with current algorithm`}
      active={
        comparison ? variantKey(comparison) === variantKey(variant) : false
      }
      disabled={
        variantKey(variant) === selectedKey ||
        !formulation ||
        !formulations[variantKey(variant)]
      }
      onClick={() => compareVariant(variant)}
    >
      <GitCompareArrows />
    </IconButton>
  );
  const toggleFilter = (key: string, value: string) => {
    setPrefs((current) => {
      const chosen = current.filters[key as AlgorithmFacet] ?? [];
      return {
        ...current,
        selectedVariantKey: null,
        filters: {
          ...current.filters,
          [key]: chosen.includes(value)
            ? chosen.filter((item) => item !== value)
            : [...chosen, value],
        },
      };
    });
    setPage(0);
  };
  const resetFilter = (key: string) => {
    setPrefs((current) => ({
      ...current,
      selectedVariantKey: null,
      filters: { ...current.filters, [key]: [] },
    }));
    setPage(0);
  };
  const removeFilter = (key: string) => {
    setPrefs((current) => ({
      ...current,
      selectedVariantKey: null,
      visibleFilterKeys: current.visibleFilterKeys.filter(
        (item) => item !== key,
      ),
      filters: { ...current.filters, [key]: [] },
    }));
    setFilterPickerOpen(prefs.visibleFilterKeys.length === 1);
    setPage(0);
  };
  const swapFilters = (source: string, target: string) => {
    setPrefs((current) => ({
      ...current,
      visibleFilterKeys: swapFilterKeys(
        current.visibleFilterKeys,
        source,
        target,
      ),
    }));
  };
  const filterReorder = useFilterReorder(prefs.visibleFilterKeys, swapFilters);
  const tableColumns: AlgorithmFacet[] = prefs.filterOpen
    ? [...new Set<AlgorithmFacet>([...prefs.visibleFilterKeys, "algorithm"])]
    : ["algorithm", "version"];
  const sortControl = (
    <div className="algo-sort-wrapper">
      <IconButton
        label="Sort algorithms"
        active={prefs.sort !== "name"}
        onClick={() => setSortOpen((open) => !open)}
      >
        <ArrowDownUp />
      </IconButton>
      {sortOpen && (
        <div
          className="popover algo-sort-menu"
          role="dialog"
          aria-label="Sort algorithms"
        >
          <div className="popover-heading">Sort algorithms</div>
          {(
            [
              ["name", "Name · A to Z"],
              ["version", "Version · newest first"],
              ["runs", "Run count · highest first"],
            ] as const
          ).map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={prefs.sort === key ? "selected-option" : ""}
              onClick={() => {
                setPrefs((current) => ({ ...current, sort: key }));
                setSortOpen(false);
                setPage(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  const filterToggle = (
    <FilterToggle
      open={prefs.filterOpen}
      count={activeFilterCount}
      boardId="algo-filter-board"
      onClick={() => {
        setPrefs((current) => ({
          ...current,
          filterOpen: view === "paper" || !current.filterOpen,
        }));
        if (view === "paper") {
          setFilterPickerOpen(prefs.visibleFilterKeys.length === 0);
          onViewChange("selection");
        }
      }}
    />
  );

  return (
    <section
      className={`algo-workspace ${view === "selection" ? "algo-workspace-selection" : !sidebarOpen ? "sidebar-hidden" : ""}`}
      aria-label="MagicAlgo"
    >
      {view === "paper" && !sidebarOpen && (
        <CollapsedSidebar
          label="Open algorithms sidebar"
          onOpen={() => setSidebarOpen(true)}
        />
      )}
      {view === "paper" && sidebarOpen && (
        <aside
          className="runs-sidebar algo-selector"
          aria-labelledby="algo-sidebar-heading"
        >
          <SidebarHeading
            id="algo-sidebar-heading"
            title="Algorithms"
            count={visible.length}
            closeLabel="Close algorithms sidebar"
            onClose={() => setSidebarOpen(false)}
          />
          <div className="runs-controls">
            <div className="run-toolbar">
              {filterToggle}
              {sortControl}
            </div>
          </div>
          <SidebarListHeader label="ALGORITHM" count={visible.length} />
          <div
            className="run-list algo-options"
            role="list"
            aria-label="Select one algorithm version"
          >
            {loading && !runs.length ? (
              <p className="algo-selector-message" role="status">
                Loading algorithms?
              </p>
            ) : error && !runs.length ? (
              <p className="algo-selector-message" role="alert">
                Could not load algorithms: {error}
              </p>
            ) : !visible.length ? (
              <p className="algo-selector-message">
                No algorithms match these filters.
              </p>
            ) : (
              pageVariants.map((variant) => (
                <div
                  key={variantKey(variant)}
                  className="algo-run-entry"
                  role="listitem"
                >
                  <button
                    type="button"
                    aria-current={
                      selectedKey === variantKey(variant) ? "true" : undefined
                    }
                    className={`sidebar-option algo-run-row ${selectedKey === variantKey(variant) ? "active" : ""}`}
                    onClick={() => selectVariant(variant)}
                  >
                    <span className="algo-run-copy">
                      <strong>
                        {variant.name} · {versionLabel(variant.version)}
                      </strong>
                      <small>
                        {variant.runCount}{" "}
                        {variant.runCount === 1 ? "run" : "runs"}
                      </small>
                    </span>
                  </button>
                  {compareButton(variant)}
                </div>
              ))
            )}
          </div>
          {visible.length > pageSize && (
            <div className="algo-run-pagination">
              <Pagination
                total={visible.length}
                page={currentPage}
                pageSize={pageSize}
                onPageChange={setPage}
                label="algorithms"
              />
            </div>
          )}
        </aside>
      )}
      <div className="panels-area algo-main">
        <ViewHeader
          className={view === "selection" ? "runs-view-intro" : ""}
          title={
            view === "selection"
              ? "Algorithm selection"
              : "Mathematical algorithm"
          }
          badge={
            view === "selection" ? (
              <span className="count">{visible.length}</span>
            ) : undefined
          }
          actions={
            view === "selection" ? (
              <div className="run-toolbar algo-selection-toolbar">
                {filterToggle}
                {sortControl}
              </div>
            ) : (
              <>
                {comparisonFormulation && (
                  <IconButton
                    label="Close algorithm comparison"
                    onClick={() =>
                      setPrefs((current) => ({
                        ...current,
                        comparisonVariantKey: null,
                      }))
                    }
                  >
                    <X />
                  </IconButton>
                )}
                {formulation && (
                  <label className="algo-notes-toggle">
                    <input
                      type="checkbox"
                      checked={prefs.showNotes}
                      onChange={(event) =>
                        setPrefs((current) => ({
                          ...current,
                          showNotes: event.target.checked,
                        }))
                      }
                    />{" "}
                    Show notes
                  </label>
                )}
              </>
            )
          }
        />
        <div className="panels-scroll algo-main-scroll">
          {view === "selection" && (
            <section className="algo-selection" aria-label="Algorithm versions">
              {prefs.filterOpen && (
                <FilterBoard
                  id="algo-filter-board"
                  label="Algorithm filters"
                  facets={facets}
                  visibleKeys={prefs.visibleFilterKeys}
                  selected={prefs.filters}
                  shownCount={visible.length}
                  totalCount={variants.length}
                  countLabel="versions"
                  pickerOpen={filterPickerOpen}
                  dropKey={filterReorder.dropKey}
                  onPickerToggle={() => setFilterPickerOpen((open) => !open)}
                  onAdd={(key) => {
                    setPrefs((current) => ({
                      ...current,
                      visibleFilterKeys: [
                        ...current.visibleFilterKeys,
                        key as AlgorithmFacet,
                      ],
                    }));
                    setFilterPickerOpen(false);
                  }}
                  onClear={() => {
                    setPrefs((current) => ({
                      ...current,
                      filters: { algorithm: [], version: [] },
                      visibleFilterKeys: [],
                      selectedVariantKey: null,
                    }));
                    setFilterPickerOpen(true);
                    setPage(0);
                  }}
                  onReset={resetFilter}
                  onRemove={removeFilter}
                  onToggle={toggleFilter}
                  formatOption={(option) => option}
                  optionCount={(key, option) => {
                    const eligible = filterAlgorithmVariants(
                      variants,
                      { ...prefs, search: "" },
                      key as AlgorithmFacet,
                    );
                    return eligible.filter((variant) =>
                      key === "algorithm"
                        ? variant.name === option
                        : versionLabel(variant.version) === option,
                    ).length;
                  }}
                  onDragStart={filterReorder.onDragStart}
                  onDragOver={filterReorder.onDragOver}
                  onDrop={filterReorder.onDrop}
                  onDragEnd={filterReorder.onDragEnd}
                  onDragKeyDown={filterReorder.onDragKeyDown}
                />
              )}
              <SelectionTable
                className="algo-selection-table"
                label="Algorithm versions"
                pagination={
                  visible.length > pageSize ? (
                    <Pagination
                      total={visible.length}
                      page={currentPage}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      label="algorithms"
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
                      {tableColumns.map((key) =>
                        prefs.filterOpen &&
                        prefs.visibleFilterKeys.includes(key) ? (
                          <FilterColumnHeader
                            key={key}
                            filterKey={key}
                            label={
                              key === "algorithm" ? "Algorithm" : "Version"
                            }
                            selected={prefs.filters[key]}
                            className={`algo-${key}-column`}
                            reorder={filterReorder}
                          />
                        ) : (
                          <th
                            key={key}
                            scope="col"
                            className={`algo-${key}-column`}
                          >
                            {key === "algorithm" ? "Algorithm" : "Version"}
                          </th>
                        ),
                      )}
                      {!prefs.filterOpen && <th scope="col">Runs</th>}
                      <th scope="col" className="algo-compare-column">
                        Compare
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageVariants.map((variant) => (
                      <tr
                        key={variantKey(variant)}
                        onClick={() => selectVariant(variant)}
                        className={`selectable-row ${selectedKey === variantKey(variant) ? "selection-row-active" : ""}`.trim()}
                      >
                        <td className="selection-choice-column">
                          <SelectionRadio
                            name="algo-selected-variant"
                            label={`Select ${variant.name} ${versionLabel(variant.version)}`}
                            checked={selectedKey === variantKey(variant)}
                            onChange={() => selectVariant(variant)}
                          />
                        </td>
                        {tableColumns.map((key) => (
                          <td
                            key={key}
                            className={`algo-${key}-column ${
                              prefs.filterOpen &&
                              prefs.visibleFilterKeys.includes(key) &&
                              isSelectedFilterValue(
                                prefs.filters[key],
                                key === "algorithm"
                                  ? variant.name
                                  : versionLabel(variant.version),
                              )
                                ? "filter-cell-selected"
                                : ""
                            }`.trim()}
                          >
                            {key === "algorithm"
                              ? variant.name
                              : versionLabel(variant.version)}
                          </td>
                        ))}
                        {!prefs.filterOpen && <td>{variant.runCount}</td>}
                        <td
                          className="algo-compare-column"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {compareButton(variant)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {loading && !runs.length && (
                  <p className="algo-selector-message" role="status">
                    Loading algorithms…
                  </p>
                )}
                {error && !runs.length && (
                  <p className="algo-selector-message" role="alert">
                    Could not load algorithms: {error}
                  </p>
                )}
                {!loading && !error && !visible.length && (
                  <p className="algo-selector-message">
                    No algorithm versions match these filters.
                  </p>
                )}
              </SelectionTable>
            </section>
          )}
          {view === "paper" && (
            <section
              className="algo-paper-section"
              aria-label="Mathematical algorithm"
            >
              <div
                className={`algo-paper ${comparisonFormulation ? "algo-paper-comparing" : ""}`}
                tabIndex={comparisonFormulation ? 0 : undefined}
                role={comparisonFormulation ? "region" : undefined}
                aria-label={
                  comparisonFormulation ? "Algorithm comparison" : undefined
                }
              >
                {!selected ? (
                  <div className="algo-empty">
                    <h2>No algorithm selected</h2>
                    <p>Adjust the filters or select an algorithm version.</p>
                  </div>
                ) : !formulation ? (
                  <div className="algo-empty">
                    <h2>
                      {selected.name} · {versionLabel(selected.version)}
                    </h2>
                    <p>
                      No mathematical formulation has been authored for this
                      exact version yet.
                    </p>
                  </div>
                ) : (
                  <AlgorithmDocument
                    formulation={formulation}
                    version={selected.version}
                    provenance={
                      sample
                        ? "Reference formulation for synthetic sample runs. These runs do not execute this algorithm."
                        : "Reference formulation; verify the equations against this implementation."
                    }
                    showNotes={prefs.showNotes}
                    comparison={
                      comparison && comparisonFormulation
                        ? {
                            formulation: comparisonFormulation,
                            version: comparison.version,
                          }
                        : undefined
                    }
                  />
                )}
              </div>
            </section>
          )}
          {storageError && (
            <p className="algo-storage-error" role="status">
              {storageError}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
