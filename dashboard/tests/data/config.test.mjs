import { test } from "node:test";
import assert from "node:assert/strict";
import { configValue } from "../../lib/data/config.ts";
import {
  configValues,
  filterValue,
  matchesRunFilters,
} from "../../lib/data/run-filters.ts";
import { parameterValue } from "../../lib/data/tuning.ts";

test("adapter, filter and tuning config lookups honor exact keys before nested paths", () => {
  const run = {
    config: {
      "model.width": 256,
      model: { width: 128 },
      nil: null,
      flags: [1, 2],
    },
    tags: ["baseline"],
    status: "finished",
  };
  assert.equal(configValue(run.config, "model.width"), 256);
  assert.deepEqual(filterValue(run, "config:model.width"), ["256"]);
  assert.equal(parameterValue(run, "model.width"), "256");
  assert.deepEqual(filterValue(run, "config:nil"), ["null"]);
  assert.deepEqual(filterValue(run, "config:flags"), []);
  assert.equal(configValue(run.config, "toString"), undefined);
  assert.equal(configValue(run.config, "model.missing"), undefined);
  assert.equal(
    matchesRunFilters(run, {
      "config:model.width": ["128", "256"],
      tags: ['"baseline"'],
    }),
    true,
  );
  assert.equal(matchesRunFilters(run, { "config:missing": ["null"] }), false);
  assert.deepEqual(
    configValues(run.config).filter(([key]) => key === "model.width"),
    [["model.width", "256"]],
  );
});
