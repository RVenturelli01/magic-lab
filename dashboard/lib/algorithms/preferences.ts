import type { AlgorithmFacet, AlgorithmSort } from "./catalog";

export interface AlgorithmPreferences {
  selectedVariantKey: string | null;
  comparisonVariantKey: string | null;
  search: string;
  filters: Record<AlgorithmFacet, string[]>;
  visibleFilterKeys: AlgorithmFacet[];
  sort: AlgorithmSort;
  filterOpen: boolean;
  showNotes: boolean;
}

export function defaultAlgorithmPreferences(): AlgorithmPreferences {
  return {
    selectedVariantKey: null,
    comparisonVariantKey: null,
    search: "",
    filters: { algorithm: [], version: [] },
    visibleFilterKeys: ["algorithm", "version"],
    sort: "name",
    filterOpen: false,
    showNotes: false,
  };
}

export function parseAlgorithmPreferences(
  value: unknown,
): AlgorithmPreferences {
  const defaults = defaultAlgorithmPreferences();
  if (!value || typeof value !== "object" || Array.isArray(value))
    return defaults;
  const source = value as Record<string, unknown>;
  const filters = { ...defaults.filters };
  if (
    source.filters &&
    typeof source.filters === "object" &&
    !Array.isArray(source.filters)
  ) {
    const raw = source.filters as Record<string, unknown>;
    for (const [facet, values] of Object.entries(raw)) {
      if (
        (facet === "algorithm" || facet === "version") &&
        Array.isArray(values)
      )
        filters[facet] = values.filter(
          (item): item is string => typeof item === "string",
        );
    }
  }
  return {
    comparisonVariantKey:
      typeof source.comparisonVariantKey === "string"
        ? source.comparisonVariantKey
        : null,
    selectedVariantKey:
      typeof source.selectedVariantKey === "string"
        ? source.selectedVariantKey
        : null,
    search: "",
    filters,
    visibleFilterKeys: Array.isArray(source.visibleFilterKeys)
      ? source.visibleFilterKeys.filter(
          (item): item is AlgorithmFacet =>
            item === "algorithm" || item === "version",
        )
      : defaults.visibleFilterKeys,
    sort:
      source.sort === "runs" || source.sort === "version"
        ? source.sort
        : "name",
    filterOpen: source.filterOpen === true,
    showNotes: source.showNotes === true,
  };
}
