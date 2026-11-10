import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildChartData,
  compact,
  configuredRange,
  dataRange,
  defaultChartSettings,
  restoreChartSettings,
  zoomRange,
  selectedRange,
  panRange,
  legendLabel,
  linearTicks,
} from "../../lib/data/chart-model.ts";
import {
  compileExpression,
  expressionError,
} from "../../lib/data/chart-expression.ts";

const run = (id) => ({
  id,
  name: id,
  color: "#123456",
  createdAt: "2026-01-01T00:00:00Z",
  config: { learning_rate: 0.5 },
});
const point = (step, value) => ({
  step,
  timestamp: new Date(Date.UTC(2026, 0, 1) + step * 1000).toISOString(),
  values: value === undefined ? {} : { loss: value },
});
const a = run("run.with.dots"),
  b = run("step");
const series = [{ id: "step", name: "Group", color: "#123456", runs: [a, b] }];
const histories = {
  [a.id]: [point(0, 2), point(1, undefined), point(2, 6)],
  [b.id]: [point(0, 4), point(1, undefined), point(2, 10)],
};

test("chart aggregation uses exact steps, preserves gaps, and cannot collide with run IDs", () => {
  const settings = defaultChartSettings("loss");
  const original = structuredClone(histories);
  const plot = buildChartData(series, histories, settings);
  assert.equal(plot.lines[0].key, "v0");
  assert.deepEqual(plot.lines[0].runIds, [a.id, b.id]);
  assert.deepEqual(
    plot.data.map((row) => row.x),
    [0, 1, 2],
  );
  assert.deepEqual(
    plot.data.map((row) => row.v0),
    [3, undefined, 8],
  );
  assert.deepEqual(plot.data[0].v0_range, [2, 4]);
  assert.deepEqual(histories, original);
  assert.equal(compact(1.234), "1.234");
  assert.equal(compact(0.00432), "0.00432");
});

test("standard deviation and standard error use sample variance and available observations", () => {
  const settings = { ...defaultChartSettings("loss"), band: "stddev" };
  const plot = buildChartData(series, histories, settings);
  const spread = Math.sqrt(2);
  assert.deepEqual(plot.data[0].v0_range, [3 - spread, 3 + spread]);
  const stderr = buildChartData(series, histories, {
    ...settings,
    band: "stderr",
  });
  assert.deepEqual(stderr.data[0].v0_range, [2, 4]);
  const individual = buildChartData(series, histories, {
    ...settings,
    groupRuns: false,
  });
  assert.equal(individual.lines.length, 2);
  assert.deepEqual(
    individual.lines.map((line) => line.runIds),
    [[a.id], [b.id]],
  );
  assert.equal(individual.data[0].v0_range, undefined);
});

test("aggregation methods and smoothing calculate expected values", () => {
  const settings = defaultChartSettings("loss");
  assert.equal(
    buildChartData(series, histories, { ...settings, aggregate: "min" }).data[0]
      .v0,
    2,
  );
  assert.equal(
    buildChartData(series, histories, { ...settings, aggregate: "max" }).data[0]
      .v0,
    4,
  );
  assert.equal(
    buildChartData(series, histories, { ...settings, aggregate: "median" })
      .data[0].v0,
    3,
  );
  assert.equal(
    buildChartData(series, histories, { ...settings, smoothing: 0.5 }).data.at(
      -1,
    ).v0,
    5.5,
  );
  assert.equal(
    buildChartData(series, histories, {
      ...settings,
      smoothing: 0.5,
      smoothingMethod: "moving-average",
    }).data.at(-1).v0,
    5.5,
  );
  assert.equal(
    buildChartData(series, histories, {
      ...settings,
      smoothing: 0.9,
      smoothingMethod: "none",
    }).data.at(-1).v0,
    8,
  );
  for (const method of ["twema", "gaussian"]) {
    const result = buildChartData(series, histories, {
      ...settings,
      smoothing: 0.5,
      smoothingMethod: method,
    });
    assert.ok(
      result.data
        .filter((row) => row.v0 !== undefined)
        .every((row) => row.v0 >= 3 && row.v0 <= 8),
    );
  }
});

test("log axes exclude nonpositive values and retain a finite domain", () => {
  const settings = {
    ...defaultChartSettings("loss"),
    xScale: "log",
    yScale: "log",
  };
  const plot = buildChartData(
    [{ ...series[0], runs: [a] }],
    { [a.id]: [point(0, 1), point(1, -2), point(2, 0), point(3, 4)] },
    settings,
  );
  assert.deepEqual(
    plot.data.map((row) => row.x),
    [1, 2, 3],
  );
  assert.deepEqual(
    plot.data.map((row) => row.v0),
    [null, null, 4],
  );
  assert.ok(
    dataRange(plot.data, plot.lines, "y", true).every(
      (value) => Number.isFinite(value) && value > 0,
    ),
  );
});

test("relative time, metric X axes, and calculated metrics use the selected observations", () => {
  const settings = {
    ...defaultChartSettings("loss"),
    xAxis: "runtime",
    xExpression: "x / 2",
    expressions: [
      { name: "Scaled", formula: "${loss} * ${config:learning_rate}" },
    ],
  };
  const plot = buildChartData(series, histories, settings);
  assert.deepEqual(
    plot.data.map((row) => row.x),
    [0, 0.5, 1],
  );
  assert.equal(plot.data[0].v1, 1.5);
  assert.equal(plot.lines[1].metric, "Scaled");
  const againstLoss = buildChartData([{ ...series[0], runs: [a] }], histories, {
    ...defaultChartSettings("loss"),
    xAxis: "metric:loss",
  });
  assert.deepEqual(
    againstLoss.data.map((row) => row.x),
    [2, 6],
  );
});

test("expression grammar honors precedence, supports functions, and rejects executable input", () => {
  const evaluate = (source) =>
    compileExpression(source)((name) => (name === "loss" ? 4 : NaN));
  assert.equal(evaluate("1 + 2 * 3"), 7);
  assert.equal(evaluate("-2^2"), -4);
  assert.equal(evaluate("2^3^2"), 512);
  assert.equal(evaluate("max(2, sqrt(${loss})) / 2"), 1);
  for (const source of [
    "globalThis.alert(1)",
    "constructor(1)",
    "${loss}; fetch('url')",
    "1 +",
    "sqrt(1, 2)",
    "(1+2",
    "min(1)",
  ])
    assert.ok(expressionError(source), source);
  assert.ok(Number.isNaN(evaluate("${missing} + 1")));
});

test("axis bounds support one automatic endpoint and log zoom stays positive", () => {
  assert.deepEqual(configuredRange("", "", "linear"), {});
  assert.deepEqual(configuredRange("2", "", "linear", [0, 10]).range, [2, 10]);
  assert.deepEqual(configuredRange("", "4", "linear", [0, 10]).range, [0, 4]);
  for (const [low, high, scale] of [
    ["10", "1", "linear"],
    ["NaN", "2", "linear"],
    ["0", "10", "log"],
  ])
    assert.ok(configuredRange(low, high, scale).error);
  assert.deepEqual(zoomRange([0, 100], 0.5), [25, 75]);
  const logarithmic = zoomRange([1, 100], 0.5, 0.5, true);
  assert.ok(Math.abs(logarithmic[0] - Math.sqrt(10)) < 1e-10);
  assert.ok(Math.abs(logarithmic[1] - Math.sqrt(1000)) < 1e-10);
  assert.deepEqual(selectedRange(0.8, 0.2, [0, 100]), [20, 80]);
  assert.deepEqual(panRange([20, 80], -0.5), [-10, 50]);
  const selection = selectedRange(0.75, 0.25, [1, 10000], true);
  assert.ok(Math.abs(selection[0] - 10) < 1e-10);
  assert.ok(Math.abs(selection[1] - 1000) < 1e-10);
  assert.deepEqual(panRange([1, 100], 0.5, true), [10, 1000]);
});

test("stored settings are validated and sampling preserves first and last observations", () => {
  const restored = restoreChartSettings("loss", {
    yScale: "bogus",
    smoothing: NaN,
    lineWidth: -2,
    metrics: [],
    expressions: [{ name: "invalid", formula: "eval(1)" }],
  });
  assert.equal(restored.yScale, "linear");
  assert.equal(restored.smoothing, null);
  assert.equal(restored.lineWidth, 1.2);
  assert.deepEqual(restored.metrics, ["loss"]);
  assert.deepEqual(restored.expressions, []);
  const samples = Array.from({ length: 2501 }, (_, i) => point(i, i));
  const plot = buildChartData(
    [{ ...series[0], runs: [a] }],
    { [a.id]: samples },
    { ...defaultChartSettings("loss"), pointAggregation: "sample" },
  );
  assert.equal(plot.data.length, 1000);
  assert.equal(plot.data[0].x, 0);
  assert.equal(plot.data.at(-1).x, 2500);
});

test("advanced legends use literal templates and restore validated series styles", () => {
  const id = JSON.stringify(["step", "loss"]);
  const settings = restoreChartSettings("loss", {
    seriesLabels: { [id]: "Baseline ${mean} (${min}, ${max}) at ${x}" },
    seriesStyles: {
      [id]: { color: "#ABCDEF", width: 2 },
      invalid: { color: 'url("x")', width: 100 },
    },
  });
  const plot = buildChartData(series, histories, settings);
  assert.equal(plot.lines[0].color, "#ABCDEF");
  assert.equal(legendLabel(plot.lines[0], settings), "Baseline 8 (6, 10) at 2");
  assert.equal(settings.seriesStyles.invalid.color, undefined);
  assert.equal(settings.seriesStyles.invalid.width, undefined);
  const expressionsOnly = restoreChartSettings("loss", {
    metrics: [],
    expressions: [{ name: "scaled", formula: "${loss} / 2" }],
  });
  assert.deepEqual(expressionsOnly.metrics, []);
  assert.equal(
    buildChartData(series, histories, expressionsOnly).lines.length,
    1,
  );
});

test("linear tick positions stay evenly spaced without rounding away decimals", () => {
  assert.deepEqual(
    linearTicks([0, 8000]),
    [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
  );
  assert.deepEqual(linearTicks([0, 2.5]), [0, 0.5, 1, 1.5, 2, 2.5]);
  assert.equal(
    new Set(linearTicks([0.00012, 0.00019])).size,
    linearTicks([0.00012, 0.00019]).length,
  );
});
