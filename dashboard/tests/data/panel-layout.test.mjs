import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resizedPanelLayout,
  restorePanelLayout,
  resizedUniformPanelLayout,
} from "../../lib/data/panel-layout.ts";

test("panel resize snaps width to grid units and clamps height and width", () => {
  const start = { width: 592, height: 465 };
  const gridWidth = 1200,
    gap = 16;
  assert.equal(
    resizedPanelLayout(start, { x: 0, y: 0 }, gridWidth, gap).span,
    6,
  );
  assert.equal(
    resizedPanelLayout(
      start,
      { x: (gridWidth + gap) / 12, y: 24 },
      gridWidth,
      gap,
    ).span,
    7,
  );
  assert.deepEqual(
    resizedPanelLayout(start, { x: 10000, y: 10000 }, gridWidth, gap),
    { span: 12, height: 1200 },
  );
  assert.deepEqual(
    resizedPanelLayout(start, { x: -10000, y: -10000 }, gridWidth, gap),
    { span: 3, height: 280 },
  );
  assert.deepEqual(
    resizedPanelLayout(start, { x: -10000, y: 24 }, 350, gap, true),
    { span: 12, height: 489 },
  );
});

test("shared resize chooses equal columns for one, two, three or more panels per row", () => {
  const start = { width: 692, height: 465, columns: 2 };
  assert.deepEqual(
    resizedUniformPanelLayout(start, { x: 0, y: 24 }, 1400, 16),
    { columns: 2, height: 489 },
  );
  assert.equal(
    resizedUniformPanelLayout(start, { x: 708, y: 0 }, 1400, 16).columns,
    1,
  );
  assert.equal(
    resizedUniformPanelLayout(start, { x: -236, y: 0 }, 1400, 16).columns,
    3,
  );
  assert.equal(
    resizedUniformPanelLayout(start, { x: -354, y: 0 }, 1400, 16).columns,
    4,
  );
  assert.equal(
    resizedUniformPanelLayout(start, { x: -2000, y: 0 }, 1800, 16).columns,
    6,
  );
  assert.deepEqual(
    resizedUniformPanelLayout(
      { ...start, columns: 3 },
      { x: 1, y: 10000 },
      350,
      16,
      true,
    ),
    { columns: 3, height: 1200 },
  );
});

test("stored panel dimensions reject invalid geometry", () => {
  assert.deepEqual(restorePanelLayout({ span: 8, height: 500.2 }), {
    span: 8,
    height: 500,
  });
  for (const value of [
    null,
    {},
    { span: 13, height: 500 },
    { span: 1.5, height: 500 },
    { span: 6, height: NaN },
    { span: 6, height: Infinity },
    { span: 6, height: 50 },
  ])
    assert.equal(restorePanelLayout(value), null);
});
