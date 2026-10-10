import { createFixture } from "./support/dataset.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { geometry } from "../core/chart-geometry.mjs";
import { chartSVG } from "../core/report-svg.mjs";
import { zoomBounds, panBounds } from "../core/plot-tools.mjs";
import { defaultView, normalizeView } from "../core/view.mjs";
import { buildExportPack } from "../reporting/export-pack.mjs";
import { restoreReproduction } from "../core/reproduction.mjs";

const result = {
  groups: [
    {
      algorithm: "EG",
      name: "run",
      runs: [{ seed: 0 }],
      points: [
        { step: 0, mean: 0, sd: null, n: 1 },
        { step: 100, mean: 1, sd: null, n: 1 },
      ],
    },
  ],
};
const metric = {
  id: "eval",
  label: "Return",
  phase: "evaluation",
  unit: "reward",
  xUnit: "steps",
};
test("Responsive SVG uses pixel-sized fonts, dynamic axes and fewer ticks at small sizes", () => {
  const small = chartSVG(
    result,
    { band: "none", viewport: { width: 300, height: 180 } },
    metric,
  );
  const large = chartSVG(
    result,
    { band: "none", viewport: { width: 900, height: 600 } },
    metric,
  );
  assert.ok(small.includes('viewBox="0 0 300 180"'));
  assert.ok(large.includes('viewBox="0 0 900 600"'));
  assert.ok(
    small.includes('font-size="12"') && large.includes('font-size="12"'),
  );
  assert.ok(
    (small.match(/<text /g) || []).length <
      (large.match(/<text /g) || []).length,
  );
  assert.ok(!small.includes('preserveAspectRatio="none"'));
  assert.ok(small.includes("clip-path="));
  const b = geometry(result, {
    band: "none",
    viewport: { width: 300, height: 180 },
  });
  assert.equal(b.x(b.xmin), b.left);
  assert.equal(b.x(b.xmax), b.W - b.right);
  assert.equal(b.y(b.ymax), b.top);
  assert.equal(b.y(b.ymin), b.H - b.bottom);
});
test("Zoom preserves the pointer anchor and pan translates ranges without changing data", () => {
  const bounds = { xmin: 0, xmax: 100, ymin: -5, ymax: 5 },
    zoomed = zoomBounds(bounds, 0.5, 0.25, 0.8);
  assert.deepEqual(zoomed, { xmin: 12.5, xmax: 62.5, ymin: -1, ymax: 4 });
  assert.deepEqual(panBounds(bounds, 0.1, 0.2), {
    xmin: -10,
    xmax: 90,
    ymin: -3,
    ymax: 7,
  });
  assert.deepEqual(zoomBounds(zoomed, 2, 0.25, 0.8), bounds);
});
test("Metric ranges override grid bounds, persist through exports and reject invalid domains", async () => {
  const dataset = createFixture(),
    v = defaultView(dataset),
    id = v.metric;
  const range = { xmin: 100, xmax: 1000, ymin: 0.4, ymax: 0.9 };
  v.chartRanges = { [id]: range };
  const b = geometry(result, {
    ...v,
    metric: id,
    plotBounds: { xmin: 0, xmax: 2000, ymin: 0, ymax: 1 },
  });
  assert.equal(b.xmin, 100);
  assert.equal(b.ymax, 0.9);
  assert.throws(() =>
    normalizeView(
      { ...v, chartRanges: { [id]: { ...range, xmax: 100 } } },
      dataset,
    ),
  );
  const pack = await buildExportPack(dataset, v, { format: "svg" }),
    restored = await restoreReproduction(pack.reproduction);
  assert.deepEqual(restored.view.chartRanges, v.chartRanges);
});

test("Directional zoom preserves the unselected axis exactly", () => {
  const b = { xmin: 0, xmax: 100, ymin: -5, ymax: 5 };
  assert.deepEqual(zoomBounds(b, 0.5, 0.5, 0.5, "x"), {
    xmin: 25,
    xmax: 75,
    ymin: -5,
    ymax: 5,
  });
  assert.deepEqual(zoomBounds(b, 0.5, 0.5, 0.5, "y"), {
    xmin: 0,
    xmax: 100,
    ymin: -2.5,
    ymax: 2.5,
  });
});
