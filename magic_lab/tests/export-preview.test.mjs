import test from "node:test";
import assert from "node:assert/strict";
import { createFixture } from "./support/dataset.mjs";
import { testApplication, memoryStorage } from "./support/application.mjs";
import { defaultView, normalizeView } from "../core/view.mjs";
import { workspace } from "../web/ui/workspace.mjs";
import { analysisState } from "../web/analysis-state.mjs";
import { mountExportPreview } from "../web/application/export-preview.mjs";

function setup(fetcher) {
  const dataset = createFixture();
  const view = {
    ...defaultView(dataset),
    tab: "workspace",
    displayMode: "latex",
  };
  const state = {
    dataset,
    view,
    exportMode: "combined",
    chartResults: analysisState(dataset, view).chartResults,
  };
  const targets = [...state.chartResults.keys()].map((key) => ({
    dataset: { chartPreview: key },
    innerHTML: "Loading",
    status: { textContent: "Loading" },
    querySelector() {
      return this.status;
    },
    setAttribute(name, value) {
      this[name] = value;
    },
  }));
  const runtime = { el: { querySelectorAll: () => targets }, fetch: fetcher };
  return { state, targets, runtime };
}

test("Only LaTeX preview persists; retired SVG mode migrates to interactive", async () => {
  const dataset = createFixture(),
    old = defaultView(dataset);
  delete old.displayMode;
  assert.equal(normalizeView(old, dataset).displayMode, "interactive");
  assert.equal(
    normalizeView({ ...old, displayMode: "svg" }, dataset).displayMode,
    "interactive",
  );
  assert.throws(
    () => normalizeView({ ...old, displayMode: "fake" }, dataset),
    /Invalid display mode/,
  );
  const storage = memoryStorage(),
    app = testApplication(dataset, storage);
  app.state.view.tab = "workspace";
  await app.handlers.click({
    target: {
      closest: (selector) =>
        selector === "[data-action]"
          ? { dataset: { action: "toggle-latex-preview" } }
          : null,
    },
  });
  assert.match(app.el.innerHTML, /data-chart-preview/);
  const restored = testApplication(dataset, storage);
  await restored.start();
  assert.equal(restored.state.view.displayMode, "latex");
  await app.handlers.click({
    target: {
      closest: (selector) =>
        selector === "[data-action]"
          ? { dataset: { action: "toggle-latex-preview" } }
          : null,
    },
  });
  assert.match(app.el.innerHTML, /class="chart-plot"/);
  app.destroy();
  restored.destroy();
});

test("Preview replaces chart bodies while keeping cards, ablation matrix and existing controls", () => {
  const app = testApplication(createFixture());
  app.state.view.tab = "workspace";
  app.state.view.displayMode = "latex";
  for (const mode of ["charts", "ablation"]) {
    app.state.view.workspaceMode = mode;
    const html = workspace(app.state);
    const charts = analysisState(app.state.dataset, app.state.view).charts;
    assert.equal(
      (html.match(/data-chart-preview=/g) || []).length,
      charts.length,
    );
    assert.equal(
      (html.match(/data-chart-metric=/g) || []).length,
      charts.length,
    );
    assert.match(html, /class="chart-grid /);
    if (mode === "ablation") assert.match(html, /class="ablation-matrix"/);
    assert.match(
      html,
      /id="latexPreview"[^>]+aria-pressed="true" class="active">LaTeX preview<\/button>/,
    );
    assert.ok(
      html.indexOf('id="latexPreview"') < html.indexOf('data-menu="settings"'),
    );
    assert.ok(
      html.indexOf('id="latexPreview"') < html.indexOf('data-menu="style"'),
    );
    assert.doesNotMatch(html, /id="displayMode"/);
    assert.match(html, /data-menu="style"/);
    assert.match(html, /data-menu="settings"/);
    assert.match(html, /data-menu="export"/);
    assert.doesNotMatch(
      html,
      /class="chart-plot"|export-preview-file|previewScale|SVG preview|Download PDF/,
    );
  }
  app.state.view.workspaceMode = "tables";
  assert.match(workspace(app.state), /comparison-table/);
  assert.doesNotMatch(workspace(app.state), /data-chart-preview/);
  app.destroy();
});

test("Compiled PDFs fill individual cards independently of combined export mode and URLs are released", async () => {
  const requests = [],
    pdf = Buffer.from("%PDF-1.4\nfixture");
  const app = setup(async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      json: async () =>
        url.endsWith("capabilities")
          ? { latex: { available: true } }
          : {
              files: app.targets.map((_, i) => ({
                name: `chart-${i}.pdf`,
                type: "application/pdf",
                data: pdf.toString("base64"),
              })),
            },
    };
  });
  const controller = mountExportPreview(app.state, app.runtime);
  await controller.ready;
  const input = JSON.parse(requests[1].options.body);
  assert.deepEqual(input.view, app.state.view);
  assert.equal(input.mode, undefined);
  for (const target of app.targets) {
    assert.match(target.innerHTML, /<object type="application\/pdf"/);
    assert.match(target.innerHTML, /#toolbar=0/);
    assert.doesNotMatch(target.innerHTML, /<button|<a |<figure/);
    assert.equal(target["aria-busy"], "false");
  }
  const url = app.targets[0].innerHTML.match(/data="([^"#]+)/)[1];
  assert.deepEqual(
    new Uint8Array(await (await fetch(url)).arrayBuffer()),
    new Uint8Array(pdf),
  );
  controller.destroy();
  await assert.rejects(fetch(url));
});

test("Disposed requests cannot update cards; missing compiler errors stay inside each card", async () => {
  let finish, signal;
  const late = setup((_url, options) => {
    signal = options.signal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const controller = mountExportPreview(late.state, late.runtime);
  controller.destroy();
  assert.equal(signal.aborted, true);
  finish({
    ok: true,
    json: async () => ({ latex: { available: false, reason: "missing" } }),
  });
  await controller.ready;
  assert.equal(late.targets[0].status.textContent, "Loading");
  const missing = setup(async () => ({
    ok: true,
    json: async () => ({
      latex: { available: false, reason: "pdflatex not installed" },
    }),
  }));
  const preview = mountExportPreview(missing.state, missing.runtime);
  await preview.ready;
  assert.match(missing.targets[0].status.textContent, /pdflatex not installed/);
  assert.equal(missing.targets[0].innerHTML, "Loading");
  preview.destroy();
});
