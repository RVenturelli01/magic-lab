import type { AlgorithmLine } from "./formulations.ts";

/** Exact sequence anchors keep insertions from shifting all following lines. */
export function matchingIndices<T>(
  left: T[],
  right: T[],
  equal: (a: T, b: T) => boolean,
): [number, number][] {
  const lengths = Array.from(
    { length: left.length + 1 },
    () => new Uint32Array(right.length + 1),
  );
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      lengths[i][j] = equal(left[i], right[j])
        ? lengths[i + 1][j + 1] + 1
        : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const matches: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (equal(left[i], right[j])) matches.push([i++, j++]);
    else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++;
    else j++;
  }
  return matches;
}

export interface AlgorithmDiffRow {
  left: number | null;
  right: number | null;
  changed: boolean;
}

export function alignAlgorithmLines(
  left: AlgorithmLine[],
  right: AlgorithmLine[],
): AlgorithmDiffRow[] {
  const anchors = matchingIndices(
    left,
    right,
    (a, b) => a.tex === b.tex && a.depth === b.depth && a.kind === b.kind,
  );
  const rows: AlgorithmDiffRow[] = [];
  let i = 0;
  let j = 0;
  for (const [a, b] of [...anchors, [left.length, right.length]]) {
    while (i < a || j < b) {
      rows.push({
        left: i < a ? i++ : null,
        right: j < b ? j++ : null,
        changed: true,
      });
    }
    if (a < left.length) {
      rows.push({
        left: i++,
        right: j++,
        changed: left[a].note !== right[b].note,
      });
    }
  }
  return rows;
}
