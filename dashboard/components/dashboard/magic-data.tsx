"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  datasetByteLimit,
  parseDataset,
  profileDataset,
  type Dataset,
} from "@/lib/data/datasets";
import {
  deleteDataset,
  listDatasets,
  saveDataset,
} from "@/lib/data/dataset-store";
import { downloadBlob } from "@/lib/download";
import ViewHeader from "./view-header";
import SelectionTable from "./selection-table";
import Pagination from "./pagination";
import SelectionRadio from "./selection-radio";
import SidebarHeading, { CollapsedSidebar } from "./sidebar-heading";
import SidebarListHeader from "./sidebar-list-header";

const pageSize = 50;
const display = (value: unknown) =>
  value === null
    ? "—"
    : typeof value === "number"
      ? value.toLocaleString(undefined, { maximumSignificantDigits: 6 })
      : String(value);

export default function MagicData({
  view,
  onViewChange,
}: {
  view: "selection" | "viewer";
  onViewChange: (view: "selection" | "viewer") => void;
}) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setDatasets(await listDatasets());
    } catch {
      setError(
        "Saved datasets could not be read. Check browser storage access and retry.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    listDatasets().then(
      (items) => {
        if (active) {
          setDatasets(items);
          setLoading(false);
        }
      },
      () => {
        if (active) {
          setError(
            "Saved datasets could not be read. Check browser storage access and retry.",
          );
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);
  const visible = useMemo(
    () =>
      datasets
        .filter((dataset) =>
          dataset.name.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        ),
    [datasets, search],
  );
  const selected =
    visible.find((dataset) => dataset.id === selectedId) ?? visible[0];
  const profiles = useMemo(
    () => (selected ? profileDataset(selected) : []),
    [selected],
  );
  const itemCount =
    view === "selection" ? visible.length : (selected?.rows.length ?? 0);
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(itemCount / pageSize) - 1),
  );
  const select = (id: string) => {
    setSelectedId(id);
    setPage(0);
  };
  const pagination =
    itemCount > pageSize ? (
      <Pagination
        total={itemCount}
        page={currentPage}
        pageSize={pageSize}
        onPageChange={setPage}
        label={view === "selection" ? "datasets" : "rows"}
      />
    ) : undefined;
  async function importFile(file: File) {
    setBusy(true);
    setError("");
    try {
      if (file.size > datasetByteLimit)
        throw new Error("Choose a file no larger than 20 MiB.");
      const dataset = parseDataset(file.name, await file.text());
      await saveDataset(dataset);
      setDatasets((current) => [...current, dataset]);
      select(dataset.id);
      setSearch("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Dataset could not be saved. Check browser storage space.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function remove() {
    if (
      !selected ||
      selected.isSample ||
      !window.confirm(
        `Remove “${selected.name}” from this browser? The original file will remain on disk.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await deleteDataset(selected.id);
      setDatasets((current) =>
        current.filter((dataset) => dataset.id !== selected.id),
      );
      setPage(0);
    } catch {
      setError("Dataset could not be removed. Retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={`algo-workspace ${view === "selection" ? "algo-workspace-selection" : !sidebarOpen ? "sidebar-hidden" : ""}`}
      aria-label="MagicData"
    >
      {view === "viewer" && !sidebarOpen && (
        <CollapsedSidebar
          label="Open datasets sidebar"
          onOpen={() => setSidebarOpen(true)}
        />
      )}
      {view === "viewer" && sidebarOpen && (
        <aside
          className="runs-sidebar algo-selector"
          aria-labelledby="data-sidebar-heading"
        >
          <SidebarHeading
            id="data-sidebar-heading"
            title="Datasets"
            count={visible.length}
            closeLabel="Close datasets sidebar"
            onClose={() => setSidebarOpen(false)}
          />
          <SidebarListHeader label="DATASET" count={visible.length} />
          <div
            className="run-list algo-options"
            role="listbox"
            aria-label="Select one dataset"
          >
            {visible.map((dataset) => (
              <button
                key={dataset.id}
                role="option"
                aria-selected={selected?.id === dataset.id}
                className="sidebar-option algo-run-row"
                onClick={() => select(dataset.id)}
              >
                <span className="algo-run-copy">
                  <strong>{dataset.name}</strong>
                  <small>
                    {dataset.rows.length.toLocaleString()} rows ·{" "}
                    {dataset.columns.length} columns
                    {dataset.isSample && " · Sample data"}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </aside>
      )}
      <div className="panels-area algo-main">
        <ViewHeader
          className={view === "selection" ? "runs-view-intro" : ""}
          title={view === "selection" ? "Data selection" : "Data viewer"}
          badge={
            view === "selection" ? (
              <span className="count">{visible.length}</span>
            ) : undefined
          }
          actions={
            <div className="run-toolbar algo-selection-toolbar">
              {view === "selection" ? (
                <>
                  <label className="tuner-search">
                    <input
                      aria-label="Search datasets"
                      placeholder="Search datasets"
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(0);
                      }}
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={busy || loading}
                    onClick={() => input.current?.click()}
                  >
                    {busy ? "Importing…" : "Import dataset"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    disabled={!selected || busy}
                    onClick={() => {
                      if (selected)
                        downloadBlob(
                          new Blob(
                            [
                              JSON.stringify(
                                selected.rows.map((row) =>
                                  Object.fromEntries(
                                    selected.columns.map((column, index) => [
                                      column,
                                      row[index],
                                    ]),
                                  ),
                                ),
                                null,
                                2,
                              ),
                            ],
                            { type: "application/json" },
                          ),
                          selected.name.replace(/\.(csv|json)$/i, "") + ".json",
                        );
                    }}
                  >
                    Export JSON
                  </button>
                  <button
                    disabled={!selected || selected.isSample || busy}
                    onClick={() => void remove()}
                  >
                    Remove dataset
                  </button>
                </>
              )}
            </div>
          }
        />
        <input
          ref={input}
          className="sr-only"
          type="file"
          accept=".csv,.json"
          aria-label="Import dataset file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
          }}
        />
        <div className="panels-scroll algo-main-scroll">
          {error && (
            <div className="algo-selector-message" role="alert">
              {error}{" "}
              <button disabled={busy} onClick={() => void load()}>
                Retry loading
              </button>
            </div>
          )}
          {loading ? (
            <p className="algo-selector-message" role="status">
              Loading datasets…
            </p>
          ) : view === "selection" ? (
            <>
              <p className="algo-selector-message">
                Import CSV or a JSON array of objects (up to 20 MiB). Datasets
                are saved in this browser only; keep your original files.
              </p>
              <SelectionTable
                label="Available datasets"
                pagination={pagination}
              >
                <table>
                  <thead>
                    <tr>
                      <th className="selection-choice-column" scope="col">
                        Select
                      </th>
                      {["Dataset", "Format", "Rows", "Columns", "Imported"].map(
                        (label) => (
                          <th scope="col" key={label}>
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visible
                      .slice(
                        currentPage * pageSize,
                        (currentPage + 1) * pageSize,
                      )
                      .map((dataset) => (
                        <tr
                          key={dataset.id}
                          onClick={() => select(dataset.id)}
                          className={`selectable-row ${selected?.id === dataset.id ? "selection-row-active" : ""}`}
                        >
                          <td className="selection-choice-column">
                            <SelectionRadio
                              name="data-selected-dataset"
                              label={`Select ${dataset.name}`}
                              checked={selected?.id === dataset.id}
                              onChange={() => select(dataset.id)}
                            />
                          </td>
                          <td>
                            {dataset.name}
                            {dataset.isSample && (
                              <>
                                {" "}
                                <span className="tuner-sample">
                                  Sample data
                                </span>
                              </>
                            )}
                          </td>
                          <td>{dataset.format}</td>
                          <td>{dataset.rows.length.toLocaleString()}</td>
                          <td>{dataset.columns.length}</td>
                          <td>
                            {dataset.isSample
                              ? "—"
                              : new Date(dataset.importedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    {!visible.length && (
                      <tr>
                        <td colSpan={6}>
                          {datasets.length
                            ? "No datasets match this search."
                            : "No datasets yet. Import a dataset to get started."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </SelectionTable>
            </>
          ) : !selected ? (
            <p className="algo-selector-message">
              No dataset selected.{" "}
              <button onClick={() => onViewChange("selection")}>
                Go to Data selection
              </button>
            </p>
          ) : (
            <>
              <h3>{selected.name}</h3>
              {selected.isSample && (
                <p>
                  <span className="tuner-sample">
                    Deterministic synthetic sample data
                  </span>
                </p>
              )}
              <p>
                {selected.rows.length.toLocaleString()} rows ·{" "}
                {selected.columns.length} columns · {selected.format}
              </p>
              <h3>Column analysis</h3>
              <SelectionTable label="Column analysis">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Column",
                        "Type",
                        "Missing",
                        "Distinct",
                        "Min",
                        "Mean",
                        "Max",
                      ].map((label) => (
                        <th key={label} scope="col">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((column) => (
                      <tr key={column.name}>
                        <th scope="row">{column.name}</th>
                        <td>{column.type}</td>
                        <td>{column.missing}</td>
                        <td>{column.unique}</td>
                        <td>{display(column.min)}</td>
                        <td>{display(column.mean)}</td>
                        <td>{display(column.max)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SelectionTable>
              <h3>Data preview</h3>
              <SelectionTable label="Dataset rows" pagination={pagination}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Row</th>
                      {selected.columns.map((column) => (
                        <th key={column} scope="col">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.rows
                      .slice(
                        currentPage * pageSize,
                        (currentPage + 1) * pageSize,
                      )
                      .map((row, index) => (
                        <tr key={index}>
                          <th scope="row">
                            {currentPage * pageSize + index + 1}
                          </th>
                          {row.map((cell, column) => (
                            <td key={column} className="dataset-cell">
                              {cell === null ? (
                                <span aria-label="Missing value">—</span>
                              ) : (
                                String(cell)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    {!selected.rows.length && (
                      <tr>
                        <td colSpan={selected.columns.length + 1}>
                          This dataset has columns but no rows.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </SelectionTable>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
