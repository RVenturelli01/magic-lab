import type { Run } from "@/lib/data";

export interface AlgorithmVariant {
  name: string;
  version: string | null;
  runCount: number;
}

export type AlgorithmFacet = "algorithm" | "version";
export type AlgorithmFilters = Record<AlgorithmFacet, string[]>;
export type AlgorithmSort = "name" | "runs" | "version";

export const emptyAlgorithmFilters = (): AlgorithmFilters => ({
  algorithm: [],
  version: [],
});

function nonempty(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text || null;
}

export function algorithmForRun(
  run: Run,
): Pick<AlgorithmVariant, "name" | "version"> | null {
  const algorithm = run.config.algorithm;
  const name = nonempty(
    algorithm && typeof algorithm === "object" && !Array.isArray(algorithm)
      ? algorithm.name
      : algorithm,
  );
  if (!name) return null;
  return {
    name,
    version:
      nonempty(
        algorithm && typeof algorithm === "object" && !Array.isArray(algorithm)
          ? algorithm.version
          : null,
      ) ?? nonempty(run.config.algorithm_version),
  };
}

/** Inventory is derived from the same complete run list shown by MagicPlot. */
export function algorithmVariants(runs: Run[]): AlgorithmVariant[] {
  const variants = new Map<string, AlgorithmVariant>();
  for (const run of runs) {
    const identity = algorithmForRun(run);
    if (!identity) continue;
    const key = variantKey(identity);
    const existing = variants.get(key);
    if (existing) existing.runCount++;
    else variants.set(key, { ...identity, runCount: 1 });
  }
  return [...variants.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
      (a.version ?? "").localeCompare(b.version ?? "", undefined, {
        numeric: true,
      }),
  );
}

export function variantKey(
  variant: Pick<AlgorithmVariant, "name" | "version">,
) {
  return JSON.stringify([variant.name, variant.version]);
}

export function filterAlgorithmVariants(
  variants: AlgorithmVariant[],
  {
    search,
    filters,
    sort,
  }: { search: string; filters: AlgorithmFilters; sort: AlgorithmSort },
  except?: AlgorithmFacet,
): AlgorithmVariant[] {
  const query = search.trim().toLocaleLowerCase();
  return variants
    .filter((variant) => {
      const values: Record<AlgorithmFacet, string> = {
        algorithm: variant.name,
        version: variant.version ?? "Unversioned",
      };
      return (
        (!query ||
          `${variant.name} ${variant.version ?? "unversioned"}`
            .toLocaleLowerCase()
            .includes(query)) &&
        (Object.keys(filters) as AlgorithmFacet[]).every(
          (facet) =>
            facet === except ||
            !filters[facet].length ||
            filters[facet].includes(values[facet]),
        )
      );
    })
    .sort((a, b) =>
      sort === "runs"
        ? b.runCount - a.runCount || a.name.localeCompare(b.name)
        : sort === "version"
          ? (b.version ?? "").localeCompare(a.version ?? "", undefined, {
              numeric: true,
            }) || a.name.localeCompare(b.name)
          : a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
            (a.version ?? "").localeCompare(b.version ?? "", undefined, {
              numeric: true,
            }),
    );
}
