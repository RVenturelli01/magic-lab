import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDataset, profileDataset } from "../../lib/data/datasets.ts";
import { createSampleDatasets } from "../../lib/data/sample-datasets.ts";

test("sample datasets are deterministic, isolated and explicitly synthetic", () => {
  const datasets = createSampleDatasets();
  assert.deepEqual(datasets, createSampleDatasets());
  assert.equal(new Set(datasets.map(({ id }) => id)).size, datasets.length);
  for (const dataset of datasets) {
    assert.equal(dataset.isSample, true);
    assert.ok(dataset.rows.length > 50);
    assert.ok(
      dataset.rows.every((row) => row.length === dataset.columns.length),
    );
    assert.ok(
      dataset.rows
        .flat()
        .every(
          (value) =>
            value === null ||
            ["string", "boolean"].includes(typeof value) ||
            (typeof value === "number" && Number.isFinite(value)),
        ),
    );
    assert.ok(
      profileDataset(dataset).some((column) => column.type === "Numeric"),
    );
  }
  const classification = datasets[0];
  assert.deepEqual(
    new Set(classification.rows.map((row) => row[3])),
    new Set(["class_a", "class_b", "class_c"]),
  );
  assert.equal(profileDataset(classification)[2].missing, 9);
  assert.deepEqual(
    new Set(classification.rows.map((row) => row[4])),
    new Set(["train", "validation", "test"]),
  );
  assert.equal(datasets[2].rows.filter((row) => row[6]).length, 6);
  datasets[0].rows[0][0] = "changed";
  assert.equal(createSampleDatasets()[0].rows[0][0], "CLS-0001");
});

test("CSV preserves identifiers, quoted delimiters, escaped quotes and multiline cells", () => {
  const data = parseDataset(
    "data.csv",
    '\uFEFFid,text,value\r\n001,"a,b",2\r\n002,"a""b\nnext",\r\n',
  );
  assert.deepEqual(data.columns, ["id", "text", "value"]);
  assert.deepEqual(data.rows, [
    ["001", "a,b", "2"],
    ["002", 'a"b\nnext', null],
  ]);
  assert.equal(data.format, "CSV");
});

test("invalid CSV records, headers and quoting fail instead of losing values", () => {
  for (const text of [
    "a,b\n1",
    "a,a\n1,2",
    ",b\n1,2",
    'a\n"open',
    'a\n"ok"extra',
    'a\nb"c',
  ]) {
    assert.throws(() => parseDataset("bad.csv", text));
  }
  assert.deepEqual(parseDataset("empty.csv", "a,b\n").rows, []);
});

test("JSON unions columns and preserves scalar types and missing values", () => {
  const data = parseDataset(
    "data.json",
    '[{"id":"001","value":0,"flag":false},{"value":2,"other":"x"}]',
  );
  assert.deepEqual(data.columns, ["id", "value", "flag", "other"]);
  assert.deepEqual(data.rows, [
    ["001", 0, false, null],
    [null, 2, null, "x"],
  ]);
  for (const text of [
    "{}",
    "[]",
    "[null]",
    "[1]",
    '[{"nested":{}}]',
    '[{"a":1e400}]',
  ])
    assert.throws(() => parseDataset("bad.json", text));
});

test("profiles exclude missing values and keep boolean and mixed columns nonnumeric", () => {
  const data = parseDataset(
    "profile.json",
    '[{"x":0,"flag":false,"mixed":1,"empty":null},{"x":4,"flag":true,"mixed":"text"},{"x":null}]',
  );
  const [numeric, boolean, mixed, empty] = profileDataset(data);
  assert.deepEqual(numeric, {
    name: "x",
    type: "Numeric",
    missing: 1,
    unique: 2,
    min: 0,
    mean: 2,
    max: 4,
  });
  assert.equal(boolean.type, "Boolean");
  assert.equal(mixed.mean, null);
  assert.equal(empty.missing, 3);
  assert.equal(empty.type, "Empty");
});
