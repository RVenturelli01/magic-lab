/**
 * Capture the running dashboard in a real Chrome browser.
 * Requires dashboard dependencies, Chromium (or Chrome), and a running dashboard.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browserExecutable, launchBrowser } from "./browser-check.mjs";

const dashboardRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const chromePath = browserExecutable();

const baseUrl = process.env.DASHBOARD_URL ?? "http://127.0.0.1:5173";
const outputRoot = path.resolve(
  process.env.DASHBOARD_VISUAL_OUTPUT ??
    path.join(dashboardRoot, "outputs", "visual-check"),
);
const runId = new Date()
  .toISOString()
  .replaceAll(":", "-")
  .replaceAll(".", "-");
const outputDirectory = path.join(outputRoot, runId);
await mkdir(outputDirectory, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
});
page.setDefaultTimeout(15_000);
const report = {
  url: baseUrl,
  browser: chromePath,
  outputDirectory,
  captures: [],
  pageErrors: [],
  consoleErrors: [],
  passed: false,
};

page.on("pageerror", (error) => report.pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") report.consoleErrors.push(message.text());
});

async function capture(name) {
  // Deferred views must finish before a layout assertion or screenshot can
  // describe the actual screen, rather than the temporary loading fallback.
  await page.locator(".loading-state").first().waitFor({ state: "hidden" });
  await page.evaluate(() => document.fonts.ready);
  // Recharts resizes through ResizeObserver after the viewport changes.
  // Do not capture a desktop-sized SVG over the mobile editor controls.
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".chart-preview-canvas")].every((canvas) => {
      const svg = canvas.querySelector(".recharts-surface");
      if (!svg) return false;
      const outer = canvas.getBoundingClientRect();
      const plot = svg.getBoundingClientRect();
      return (
        Math.abs(outer.width - plot.width) < 2 &&
        Math.abs(outer.height - plot.height) < 2
      );
    }),
  );
  const filename = name + ".png";
  await page.screenshot({
    path: path.join(outputDirectory, filename),
    animations: "disabled",
  });
  report.captures.push({
    name,
    filename,
    url: page.url(),
    viewport: page.viewportSize(),
  });
}

async function verifyTunerTrialSync(viewport) {
  const trials = page.locator(".tuner-trials");
  const axes = () =>
    page
      .locator(".tuner-history-card .recharts-cartesian-axis")
      .allTextContents();
  const overviewAxes = await axes();
  await trials.getByRole("button", { name: "None", exact: true }).click();
  const row = trials.locator("tbody tr").first();
  const runName = (
    await row.getByRole("checkbox").getAttribute("aria-label")
  ).replace("Select ", "");
  const trial = (await row.locator(".tuner-run-button").textContent()).match(
    /#(\d+)/,
  )[1];
  await row.click();
  const point = page.locator(
    `.tuner-history-card .recharts-scatter-symbol path[name="${runName}"]`,
  );
  const color = await point.getAttribute("fill");
  if (JSON.stringify(await axes()) !== JSON.stringify(overviewAxes))
    throw new Error("Selecting an Overview trial changed its axes.");
  await capture(`magictuner-trial-sync-overview-${viewport}`);
  await page.getByRole("button", { name: "All charts", exact: true }).click();
  const picker = page.locator(".tuner-group-picker");
  await picker.locator("summary").waitFor();
  if (!(await picker.locator("summary").textContent()).includes("1/32"))
    throw new Error("Charts did not retain the Overview trial selection.");
  await picker.locator("summary").click();
  const option = picker
    .locator("label")
    .filter({ hasText: `Trial #${trial} ` });
  if (!(await option.getByRole("checkbox").isChecked()))
    throw new Error("The selected trial is unchecked in Charts.");
  if (
    (
      await option.locator(".run-dot").evaluate((dot) => dot.style.background)
    ).replaceAll(" ", "") !== color.replaceAll(" ", "")
  )
    throw new Error("Overview and Charts use different trial colors.");
  await option.getByRole("checkbox").uncheck();
  if (!(await picker.locator("summary").textContent()).includes("0/32"))
    throw new Error("Charts did not clear the last selected trial.");
  await picker.locator("summary").click();
  await capture(`magictuner-trial-sync-empty-${viewport}`);
  await page
    .getByRole("button", { name: "Study overview", exact: true })
    .click();
  await trials.waitFor();
  if (await trials.locator("tbody input:checked").count())
    throw new Error("Overview lost the empty selection from Charts.");
  if (
    (await page
      .locator(
        '.tuner-history-card .recharts-scatter-symbol path[fill-opacity="0.13"]',
      )
      .count()) !== 32
  )
    throw new Error(
      "Unselected Overview trial points must remain visible and faded.",
    );
  await page.getByRole("button", { name: "All charts", exact: true }).click();
  await picker.locator("summary").click();
  await option.getByRole("checkbox").check();
  await picker.locator("summary").click();
  await capture(`magictuner-trial-sync-charts-${viewport}`);
  const legend = page
    .locator(".chart-card .chart-legend button")
    .filter({ hasText: `Trial #${trial}` })
    .first();
  if (
    !(await legend.textContent()).includes(`Trial #${trial}`) ||
    (await legend.evaluate((button) => button.style.color)).replaceAll(
      " ",
      "",
    ) !== color.replaceAll(" ", "")
  )
    throw new Error(
      "Charts did not render the selected trial with its shared color.",
    );
  await page
    .getByRole("button", { name: "Study overview", exact: true })
    .click();
  await trials.waitFor();
  if (
    !(await row.getByRole("checkbox").isChecked()) ||
    (await trials.locator("tbody input:checked").count()) !== 1
  )
    throw new Error("Overview did not restore the trial selected in Charts.");
  await trials.getByRole("button", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "All charts", exact: true }).click();
  await page
    .locator(".chart-card .chart-legend button")
    .filter({ hasText: `Trial #${trial}` })
    .first()
    .click();
  if (!(await picker.locator("summary").textContent()).includes("1/32"))
    throw new Error(
      "A chart legend click did not update shared trial selection.",
    );
  await page
    .getByRole("button", { name: "Study overview", exact: true })
    .click();
  await trials.waitFor();
  if (
    !(await row.getByRole("checkbox").isChecked()) ||
    (await trials.locator("tbody input:checked").count()) !== 1 ||
    (await page
      .locator(
        '.tuner-history-card .recharts-scatter-symbol path[fill-opacity="1"]',
      )
      .count()) !== 1
  )
    throw new Error(
      "The chart legend selection did not reach Overview or fade other points.",
    );
  await capture(`magictuner-trial-sync-from-chart-${viewport}`);
  await point.click();
  if (await trials.locator("tbody input:checked").count())
    throw new Error("Clicking a selected history point did not deselect it.");
  await page.getByRole("button", { name: "All charts", exact: true }).click();
  await picker.locator("summary").click();
  await option.getByRole("checkbox").check();
  await picker.locator("summary").click();
  const card = page.locator(".chart-card").first();
  await card.hover();
  await card.getByRole("button", { name: /^Inspect / }).focus();
  await page.keyboard.press("Enter");
  const chartAxes = await card
    .locator(".recharts-cartesian-axis")
    .allTextContents();
  const location = await card
    .locator(".recharts-line-curve")
    .evaluateAll((paths, color) => {
      const path = paths.find(
        (path) =>
          path.getAttribute("stroke").replaceAll(" ", "") ===
          color.replaceAll(" ", ""),
      );
      const point = path.getPointAtLength(path.getTotalLength() * 0.6);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(
        path.getScreenCTM(),
      );
      return { x: screen.x, y: screen.y };
    }, color);
  await page.mouse.click(location.x, location.y);
  if (!(await picker.locator("summary").textContent()).includes("0/32"))
    throw new Error(
      "Clicking a curve in Inspect mode did not update shared trial selection.",
    );
  await page.mouse.click(location.x, location.y);
  if (!(await picker.locator("summary").textContent()).includes("1/32"))
    throw new Error("Clicking a faded curve did not select it again.");
  await card.getByRole("button", { name: /^Select zoom / }).focus();
  await page.keyboard.press("Enter");
  await page.mouse.click(location.x, location.y);
  if (!(await picker.locator("summary").textContent()).includes("0/32"))
    throw new Error(
      "A plain curve click in zoom mode did not toggle trial selection.",
    );
  if (
    JSON.stringify(
      await card.locator(".recharts-cartesian-axis").allTextContents(),
    ) !== JSON.stringify(chartAxes)
  )
    throw new Error("Selecting a curve changed the chart axes.");
  await card.hover();
  await card.getByRole("button", { name: "Show all", exact: true }).focus();
  await capture(`magictuner-trial-sync-show-all-${viewport}`);
  await page.keyboard.press("Enter");
  if (!(await picker.locator("summary").textContent()).includes("32/32"))
    throw new Error(
      "The chart Show all button did not restore all trial selection.",
    );
  await page
    .getByRole("button", { name: "Study overview", exact: true })
    .click();
  await trials.waitFor();
  if ((await trials.locator("tbody input:checked").count()) !== 10)
    throw new Error(
      "Overview did not retain the selection restored by the chart Show all button.",
    );
}

async function verifyFilterColumnDrag(
  boardLabel,
  source,
  target,
  header,
  captureName,
) {
  const board = page.getByLabel(boardLabel);
  const handle = board.getByRole("button", {
    name: `Reorder ${source} filter`,
  });
  const facet = board
    .locator(".filter-facet")
    .filter({ hasText: target })
    .first();
  const from = await handle.boundingBox();
  const to = await facet.boundingBox();
  if (!from || !to)
    throw new Error(`${boardLabel} filter drag target is missing.`);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  try {
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 12,
    });
    await page.locator(header + ".filter-column-drop-target").waitFor();
    await capture(captureName);
  } finally {
    await page.mouse.up();
  }
}

async function captureScrolledHeader(container, name) {
  const section = page.locator(container);
  const state = await section.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    const header = element.querySelector(".view-intro");
    return {
      scrollTop: element.scrollTop,
      headerBottom: header?.getBoundingClientRect().bottom,
      sectionTop: element.getBoundingClientRect().top,
    };
  });
  if (!state.scrollTop || state.headerBottom > state.sectionTop) {
    throw new Error(
      `${container} keeps its section header visible while scrolling.`,
    );
  }
  await capture(name);
  await section.evaluate((element) => {
    element.scrollTop = 0;
  });
}

async function captureAlgorithm(key, title) {
  await page
    .getByRole("radio", { name: "Select " + key + " Unversioned" })
    .check();
  await page.getByRole("button", { name: "Mathematical algorithm" }).click();
  await page.getByRole("heading", { name: "Algorithm 1: " + title }).waitFor();
  await assertAlgorithmFitsViewport();
  if (await page.locator(".katex-error").count()) {
    throw new Error(key + " contains an unrendered math expression.");
  }
  const policySymbol = page
    .locator('.algo-algorithm-box .algo-symbol[data-algo-symbol="π"]')
    .first();
  await policySymbol.waitFor();
  if (key === "A2C") {
    const allSymbols = page.locator(".algo-algorithm-box .algo-symbol");
    const symbolCount = await allSymbols.count();
    const hoverableSymbols = page.locator(
      ".algo-algorithm-box .algo-symbol:not(.mtight)",
    );
    for (let index = 0; index < 12; index += 1) {
      await hoverableSymbols.nth(index).hover();
      await page.getByRole("tooltip").waitFor();
      if ((await allSymbols.count()) !== symbolCount) {
        throw new Error("Variable descriptions disappeared after hovering.");
      }
    }
    await page.mouse.move(1, 1);
  }
  if (key === "SAC") {
    await policySymbol.hover();
    await page
      .getByRole("tooltip")
      .getByText("Stochastic actor policy")
      .waitFor();
    await capture("magicalgo-sac-variable-hover-desktop");
    await page.mouse.move(1, 1);
  }
  await capture("magicalgo-" + key.toLowerCase() + "-top-desktop");
  if (key === "A2C") {
    const documentWidth = await page
      .locator(".algo-main")
      .evaluate((element) => element.getBoundingClientRect().width);
    await page
      .locator(".algo-selector")
      .getByRole("button", { name: "Close algorithms sidebar" })
      .click();
    if (await page.locator(".algo-selector").count())
      throw new Error("Algorithm sidebar stayed visible after closing.");
    const expandedWidth = await page
      .locator(".algo-main")
      .evaluate((element) => element.getBoundingClientRect().width);
    if (expandedWidth <= documentWidth)
      throw new Error(
        "Algorithm document did not expand after closing the sidebar.",
      );
    await capture("magicalgo-a2c-sidebar-closed-desktop");
    await page.getByRole("button", { name: "Open algorithms sidebar" }).click();
    await page.locator(".algo-selector").waitFor();
    await capture("magicalgo-a2c-sidebar-reopened-desktop");
    await page
      .getByRole("combobox", { name: "Dashboard theme" })
      .selectOption("dark-modern");
    await capture("magicalgo-a2c-sidebar-open-dark-modern-desktop");
    await page
      .locator(".algo-selector")
      .getByRole("button", { name: "Close algorithms sidebar" })
      .click();
    await capture("magicalgo-a2c-sidebar-closed-dark-modern-desktop");
    await page.getByRole("button", { name: "Open algorithms sidebar" }).click();
    await page
      .getByRole("combobox", { name: "Dashboard theme" })
      .selectOption("light");
  }
  if (key === "PPO") {
    await page.getByRole("checkbox", { name: "Show notes" }).check();
    await capture("magicalgo-ppo-notes-desktop");
    await page.getByRole("checkbox", { name: "Show notes" }).uncheck();
  }
  await page
    .getByRole("heading", { name: "Notation" })
    .scrollIntoViewIfNeeded();
  await capture("magicalgo-" + key.toLowerCase() + "-notation-desktop");
  if (key === "PPO") {
    await captureScrolledHeader(
      ".algo-main",
      "magicalgo-document-scrolled-desktop",
    );
  }
  await page.getByRole("button", { name: "Algorithm selection" }).click();
  await page.locator(".algo-selection-table").waitFor();
}

async function verifyAlgorithmComparison() {
  await page.getByRole("radio", { name: "Select A2C Unversioned" }).check();
  const compare = (name) =>
    page.getByRole("button", {
      name: `Compare ${name} with current algorithm`,
    });
  if (!(await compare("A2C Unversioned").isDisabled()))
    throw new Error("Self comparison must be disabled.");
  await compare("A2C demo-no-entropy").focus();
  await page.keyboard.press("Enter");
  await page.locator(".algo-comparison").waitFor();
  await page.locator(".algo-comparison [data-diff]").first().waitFor();
  if (await page.locator(".algo-diff-token").count())
    throw new Error("Comparison should highlight only row backgrounds.");
  if (
    (await page.locator(".algo-paper-version").allTextContents()).join("|") !==
    "Unversioned|demo-no-entropy"
  )
    throw new Error("Comparison changed the current algorithm.");
  for (const theme of ["light", "dark-modern", "high-contrast"]) {
    await page
      .getByRole("combobox", { name: "Dashboard theme" })
      .selectOption(theme);
    await capture(`magicalgo-comparison-${theme}-desktop`);
  }
  const row = page.locator('.algo-step[data-diff="left"]').first();
  await row.evaluate((element) => element.scrollIntoView({ block: "center" }));
  // Equations keep their original typography; wide formulas remain scrollable.
  await page.locator(".algo-comparison .algo-code").evaluateAll((elements) =>
    elements.forEach((element) => {
      element.scrollLeft = element.scrollWidth;
    }),
  );
  await capture("magicalgo-comparison-equation-differences-desktop");
  await page.getByRole("checkbox", { name: "Show notes" }).check();
  const misaligned = await page
    .locator(".algo-comparison .algo-pseudocode li")
    .evaluateAll((rows) =>
      rows.some((row) => {
        const [left, right] = row.children;
        return (
          Math.abs(
            left.getBoundingClientRect().top -
              right.getBoundingClientRect().top,
          ) > 1
        );
      }),
    );
  if (misaligned)
    throw new Error("Comparison steps lost alignment when notes were opened.");
  await page.getByRole("checkbox", { name: "Show notes" }).uncheck();
  await page.reload();
  await page.locator(".loading-state").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "MagicAlgo", exact: true }).click();
  await page
    .getByRole("button", { name: "Mathematical algorithm", exact: true })
    .click();
  await page.locator(".algo-comparison").waitFor();
  if (
    (await page.locator(".algo-paper-version").allTextContents()).join("|") !==
    "Unversioned|demo-no-entropy"
  )
    throw new Error("Saved comparison was not restored.");
  await page
    .getByRole("button", { name: "Close algorithm comparison" })
    .click();
  if (await page.locator(".algo-comparison").count())
    throw new Error("Comparison did not close.");
  await page
    .getByRole("button", { name: "A2C · demo-no-entropy", exact: false })
    .click();
  await compare("A2C Unversioned").click();
  await page.locator(".algo-comparison").waitFor();
  if (!(await page.locator('.algo-step[data-diff="right"]').count()))
    throw new Error("Reverse comparison did not highlight additions.");
  await page
    .getByRole("button", { name: "Close algorithm comparison" })
    .click();
  await page.getByRole("button", { name: /PPO · Unversioned/ }).click();
  await compare("PPO demo-normalized").click();
  if (
    (await page.locator(".algo-comparison .algo-diff-placeholder").count()) !==
    2
  )
    throw new Error("Inserted PPO lines are not aligned with gaps.");
  await page
    .locator(".algo-diff-placeholder")
    .first()
    .evaluate((element) => element.scrollIntoView({ block: "center" }));
  await capture("magicalgo-comparison-insertions-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Close algorithms sidebar" })
    .first()
    .click();
  await page
    .locator(".algo-paper-comparing")
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  await capture("magicalgo-comparison-current-mobile");
  const scrolled = await page
    .locator(".algo-paper-comparing")
    .evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      return element.scrollLeft;
    });
  if (!scrolled)
    throw new Error("Mobile comparison cannot scroll to its other side.");
  await capture("magicalgo-comparison-other-mobile");
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw new Error("Comparison overflows the mobile viewport.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole("button", { name: "Close algorithm comparison" })
    .click();
  await page.getByRole("button", { name: "Open algorithms sidebar" }).click();
  await page.getByRole("button", { name: /SAC · Unversioned/ }).click();
  await compare("SAC demo-auto-temperature").click();
  await page.locator(".algo-comparison [data-diff]").first().waitFor();
  await capture("magicalgo-comparison-sac-desktop");
  if (await page.locator(".katex-error").count())
    throw new Error("Comparison has invalid mathematics.");
  await page
    .getByRole("button", { name: "Close algorithm comparison" })
    .click();
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("light");
  await page
    .getByRole("button", { name: "Algorithm selection", exact: true })
    .click();
}

async function assertAlgorithmFitsViewport() {
  const pageHeight = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  const viewportHeight = page.viewportSize().height;
  if (pageHeight > viewportHeight) {
    throw new Error(
      `Algorithm document creates page scrolling (${pageHeight}px > ${viewportHeight}px).`,
    );
  }
}

try {
  const response = await page.goto(baseUrl, {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  if (!response?.ok()) {
    throw new Error(
      "Dashboard returned HTTP " + (response?.status() ?? "unknown"),
    );
  }
  await page
    .locator(".loading-state")
    .waitFor({ state: "hidden", timeout: 20_000 });
  await capture("magicplot-runs-desktop");
  for (const theme of [
    "light",
    "dark",
    "light-modern",
    "dark-modern",
    "high-contrast",
  ]) {
    await page
      .getByRole("combobox", { name: "Dashboard theme" })
      .selectOption(theme);
    await capture(`theme-${theme}-desktop`);
    await page.setViewportSize({ width: 390, height: 844 });
    await capture(`theme-${theme}-mobile`);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("light");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page
    .getByLabel("Run filters")
    .getByText("Group", { exact: true })
    .waitFor();
  await page
    .getByLabel("Run filters")
    .getByText("PPO", { exact: true })
    .click();
  if ((await page.locator(".selection-table-runs tbody tr").count()) !== 4)
    throw new Error("Run algorithm filter did not show four PPO groups.");
  await page
    .locator(
      '.selection-table-runs th.filter-column-active .filter-column-selection[aria-label="Filtered by Algorithm: PPO"]',
    )
    .waitFor();
  if (
    (await page
      .locator(".selection-table-runs tbody td.filter-cell-selected")
      .count()) !== 4
  )
    throw new Error("Filtered run cells are not highlighted.");
  await capture("magicplot-filtered-column-desktop");
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("dark");
  await capture("magicplot-filtered-column-dark-desktop");
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("light");
  await page
    .getByLabel("Run filters")
    .getByRole("button", { name: "Reset" })
    .click();
  if (
    await page.locator(".selection-table-runs .filter-column-selection").count()
  )
    throw new Error("Reset run filter left a selected column indicator.");
  if (
    await page
      .locator(".selection-table-runs tbody td.filter-cell-selected")
      .count()
  )
    throw new Error("Reset run filter left highlighted cells.");
  await verifyFilterColumnDrag(
    "Run filters",
    "Algorithm",
    "Group",
    ".selection-table-runs th:nth-child(4)",
    "magicplot-filter-column-drag-desktop",
  );
  await capture("magicplot-group-filter-desktop");
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("dark");
  await capture("magicplot-group-filter-dark-desktop");
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("light");

  await page.getByRole("button", { name: "Tables", exact: true }).click();
  await page.locator(".scalar-panel-scroll table").first().waitFor();
  await capture("magicplot-tables-desktop");
  await page
    .getByRole("button", { name: "Download Result comparison" })
    .click();
  await capture("magicplot-table-download-desktop");
  await page.getByRole("button", { name: "Edit Result comparison" }).click();
  await page
    .getByRole("combobox", { name: "Table uncertainty" })
    .selectOption("stddev");
  await capture("magicplot-table-uncertainty-settings-desktop");
  await page.getByRole("button", { name: "Apply" }).click();
  await capture("magicplot-table-uncertainty-desktop");
  await page
    .getByRole("button", { name: "Download Result comparison" })
    .click();
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download PNG" }).click();
  const png = await pngDownload;
  const pngBytes = await readFile(await png.path());
  if (
    png.suggestedFilename() !== "Result-comparison.png" ||
    pngBytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    pngBytes.length < 1000
  ) {
    throw new Error("Table PNG download is invalid.");
  }
  await writeFile(
    path.join(outputDirectory, "magicplot-table-export.png"),
    pngBytes,
  );

  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page.getByRole("heading", { name: "Workspace", exact: true }).waitFor();
  await capture("magicplot-workspace-desktop");
  const sectionOrder = () =>
    page
      .locator(".section-heading > button[aria-expanded] > span:first-of-type")
      .allTextContents();
  const originalSections = await sectionOrder();
  const sectionHandle = page.getByRole("button", {
    name: `Reorder ${originalSections[0]} section`,
    exact: true,
  });
  await sectionHandle.dragTo(page.locator(".section-heading").nth(1));
  if ((await sectionOrder())[1] !== originalSections[0])
    throw new Error("Dragging the section grip did not swap sections.");
  await capture("magicplot-sections-reordered-desktop");
  await sectionHandle.focus();
  await sectionHandle.press("ArrowUp");
  if (JSON.stringify(await sectionOrder()) !== JSON.stringify(originalSections))
    throw new Error("Keyboard section reorder did not restore the order.");
  await page
    .getByRole("button", { name: "Panel settings", exact: true })
    .click();
  const panelSettings = page.getByRole("dialog", { name: "settings options" });
  await panelSettings.getByLabel("Panel height", { exact: true }).fill("600");
  await panelSettings.getByLabel("Smoothing", { exact: true }).fill("0.37");
  await capture("magicplot-panel-settings-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("magicplot-panel-settings-mobile");
  await panelSettings
    .getByRole("button", { name: "Reset layout and smoothing" })
    .click();
  if (
    (await panelSettings
      .getByLabel("Panel height", { exact: true })
      .inputValue()) !== "465" ||
    (await panelSettings
      .getByLabel("Smoothing", { exact: true })
      .inputValue()) !== "0"
  )
    throw new Error("Panel settings reset failed.");
  await panelSettings
    .getByLabel("Panel height", { exact: true })
    .press("Escape");
  await panelSettings.waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await captureScrolledHeader(
    ".panels-area",
    "magicplot-workspace-scrolled-desktop",
  );
  await page
    .getByRole("button", { name: "eval/mean_reward", exact: true })
    .click();
  const originalChartTitle = await page
    .getByLabel("Chart title", { exact: true })
    .inputValue();
  await capture("magicplot-chart-editor-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("magicplot-chart-editor-mobile");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel("Chart title", { exact: true }).fill("Discarded draft");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "eval/mean_reward", exact: true })
    .click();
  if (
    (await page.getByLabel("Chart title", { exact: true }).inputValue()) !==
    originalChartTitle
  )
    throw new Error("Cancel changed the saved chart title.");
  await page.getByLabel("Chart title", { exact: true }).fill("Reviewed reward");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page
    .getByRole("button", { name: "Reviewed reward", exact: true })
    .click();
  if (
    (await page.getByLabel("Chart title", { exact: true }).inputValue()) !==
    "Reviewed reward"
  )
    throw new Error("Applied chart settings did not survive reload.");
  await page
    .getByLabel("Chart title", { exact: true })
    .fill(originalChartTitle);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByRole("button", { name: "Ablations", exact: true }).click();
  await page.getByRole("heading", { name: "Ablations", exact: true }).waitFor();
  await capture("magicplot-ablations-desktop");

  await page.getByRole("button", { name: "MagicTuner", exact: true }).click();
  await page.getByRole("heading", { name: /Study selection/ }).waitFor();
  await page
    .locator(".tuner-study-list tbody tr")
    .filter({ hasText: "PPO · simulated Optuna study" })
    .waitFor();
  if (await page.getByPlaceholder("Search studies").count()) {
    throw new Error("Study search is still visible.");
  }
  if (
    await page
      .locator(".tuner-study-list tbody tr td:nth-child(2) button")
      .count()
  )
    throw new Error("Study names should be plain text.");
  await capture("magictuner-selection-desktop");
  await page
    .getByRole("radio", { name: "Select SAC · simulated Optuna study" })
    .check();
  if (!(await page.getByRole("heading", { name: /Study selection/ }).count()))
    throw new Error("Selecting a study unexpectedly opened its overview.");
  await page
    .locator(".tuner-study-list tbody tr")
    .filter({ hasText: "PPO · simulated Optuna study" })
    .locator("td:last-child")
    .click();
  if (
    !(await page
      .getByRole("radio", { name: "Select PPO · simulated Optuna study" })
      .isChecked())
  )
    throw new Error("Clicking the study row did not select PPO.");
  await page.getByRole("button", { name: "Study overview" }).click();
  await page.getByRole("heading", { name: /Overview/ }).waitFor();
  await page.getByRole("button", { name: "Study selection" }).click();
  await page.getByRole("heading", { name: /Study selection/ }).waitFor();
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  if ((await page.locator(".tuner-study-list thead th").count()) !== 3)
    throw new Error("Study table did not switch to its displayed filters.");
  await verifyFilterColumnDrag(
    "Study filters",
    "Study",
    "Completion",
    ".tuner-study-list th:nth-child(3)",
    "magictuner-filter-column-drag-desktop",
  );
  if (
    !(
      await page
        .getByLabel("Study filters")
        .locator(".filter-facet")
        .first()
        .innerText()
    ).includes("Completion")
  )
    throw new Error("Study filter drag did not swap the cards.");
  if (
    !(
      await page.locator(".tuner-study-list th:nth-child(2)").innerText()
    ).includes("COMPLETION")
  )
    throw new Error("Study table columns did not follow filter order.");
  await page
    .getByLabel("Study filters")
    .getByRole("button", { name: "Reorder Study filter" })
    .focus();
  await page.keyboard.press("ArrowLeft");
  if (
    !(
      await page
        .getByLabel("Study filters")
        .locator(".filter-facet")
        .first()
        .innerText()
    ).includes("Study")
  )
    throw new Error("Study filter keyboard reorder failed.");
  await page
    .getByLabel("Study filters")
    .getByText("SAC · simulated Optuna study", { exact: true })
    .click();
  if ((await page.locator(".tuner-study-list tbody tr").count()) !== 1)
    throw new Error("Study name filter failed.");
  if (
    !(await page
      .getByRole("radio", { name: "Select SAC · simulated Optuna study" })
      .isChecked())
  )
    throw new Error("The only visible study was not selected.");
  await page
    .locator(
      '.tuner-study-list th.filter-column-active .filter-column-selection[aria-label="Filtered by Study: SAC · simulated Optuna study"]',
    )
    .waitFor();
  if (
    (await page
      .locator(".tuner-study-list tbody td.filter-cell-selected")
      .count()) !== 1
  )
    throw new Error("Filtered study cell is not highlighted.");
  await capture("magictuner-filtered-selection-desktop");
  await page
    .getByLabel("Study filters")
    .getByRole("button", { name: "Clear all" })
    .click();
  if ((await page.locator(".tuner-study-list thead th").count()) !== 2)
    throw new Error("Study table retained columns after clearing filters.");
  await page.locator('[aria-controls="tuner-filter-board"]').click();
  if ((await page.locator(".tuner-study-list thead th").count()) !== 6)
    throw new Error("Study table did not restore its information columns.");
  await page.getByRole("button", { name: "Sort studies by trials" }).click();
  const studyRunCounts = await page
    .locator(".tuner-study-list tbody tr td:nth-child(3)")
    .allTextContents();
  if (
    studyRunCounts.some(
      (count, index) =>
        index > 0 && Number(count) > Number(studyRunCounts[index - 1]),
    )
  )
    throw new Error("Study run-count sort failed.");
  await page.getByRole("button", { name: "Sort studies by trials" }).click();
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("dark");
  await capture("magictuner-selection-dark-desktop");
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("light");
  await page.getByRole("button", { name: "Study overview" }).click();
  await page.getByRole("heading", { name: /Overview/ }).waitFor();
  await capture("magictuner-overview-desktop");
  await verifyTunerTrialSync("desktop");
  const tunerTrials = page.locator(".tuner-trials");
  await tunerTrials.scrollIntoViewIfNeeded();
  await capture("magictuner-trials-desktop");
  await tunerTrials.getByRole("button", { name: "Batch size" }).click();
  if ((await tunerTrials.locator('th[aria-sort="ascending"]').count()) !== 1)
    throw new Error("The trial table did not show its ascending sort.");
  const ascendingBatch = await tunerTrials
    .locator("tbody td:nth-child(4)")
    .allTextContents();
  if (
    ascendingBatch.some(
      (value, index) =>
        index > 0 && Number(value) < Number(ascendingBatch[index - 1]),
    )
  )
    throw new Error("Batch size was not sorted numerically.");
  await capture("magictuner-trials-sorted-desktop");
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("dark-modern");
  await capture("magictuner-trials-sorted-dark-modern-desktop");
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("high-contrast");
  await tunerTrials.getByRole("button", { name: "Batch size" }).focus();
  await capture("magictuner-trials-sort-focus-high-contrast-desktop");
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("light");
  await tunerTrials.getByRole("button", { name: "Batch size" }).click();
  const firstDescendingBatch = Number(
    await tunerTrials.locator("tbody td:nth-child(4)").first().textContent(),
  );
  await tunerTrials.getByRole("button", { name: "Next" }).click();
  const nextDescendingBatch = Number(
    await tunerTrials.locator("tbody td:nth-child(4)").first().textContent(),
  );
  if (
    firstDescendingBatch < nextDescendingBatch ||
    (await tunerTrials.locator('th[aria-sort="descending"]').count()) !== 1
  )
    throw new Error("Descending sort did not apply before pagination.");
  await tunerTrials.getByRole("button", { name: /Objective/ }).click();
  if (!(await tunerTrials.getByText("1–10 of 32").count()))
    throw new Error("Changing sort did not return to the first page.");
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("dark");
  await capture("magictuner-trials-dark-desktop");
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("light");
  await tunerTrials.locator("tbody tr").first().click();
  if (
    (await tunerTrials
      .locator('tbody input[type="checkbox"]:checked')
      .count()) !== 9
  )
    throw new Error("Clicking a table row did not toggle that trial only.");
  await capture("magictuner-trial-toggled-desktop");
  await tunerTrials.locator("tbody tr").nth(1).click();
  if (
    (await tunerTrials
      .locator('tbody input[type="checkbox"]:checked')
      .count()) !== 8
  )
    throw new Error(
      "Clicking a second table row did not toggle it independently.",
    );
  await tunerTrials.getByRole("button", { name: "None", exact: true }).click();
  if (
    (await tunerTrials
      .locator('tbody input[type="checkbox"]:checked')
      .count()) !== 0
  )
    throw new Error("None did not clear trial selection.");
  await tunerTrials.locator("tbody tr").first().click();
  if (
    (await tunerTrials
      .locator('tbody input[type="checkbox"]:checked')
      .count()) !== 1
  )
    throw new Error(
      "Clicking a table row did not add it from an empty selection.",
    );
  await tunerTrials.getByRole("button", { name: "All", exact: true }).click();
  await page.locator(".tuner-plot-card").first().scrollIntoViewIfNeeded();
  await page
    .locator(".tuner-plot-card .recharts-scatter-symbol path")
    .first()
    .dispatchEvent("click");
  if (!(await tunerTrials.getByText(/1 of 32 shown in graphs/).count()))
    throw new Error("Clicking a graph point did not isolate its trial.");
  await page
    .locator(".tuner-plot-card .tuner-plot-chart")
    .first()
    .click({ position: { x: 20, y: 20 } });
  if (!(await tunerTrials.getByText(/32 of 32 shown in graphs/).count()))
    throw new Error(
      "Clicking the parameter plot background did not restore all trials.",
    );
  await page
    .locator(
      '.tuner-history-card .recharts-scatter-symbol path[name="trial-012"]',
    )
    .click();
  if (!(await tunerTrials.getByText(/1 of 32 shown in graphs/).count()))
    throw new Error(
      "Clicking the best optimization history point did not isolate its trial.",
    );
  await page
    .locator(".tuner-history-plot")
    .click({ position: { x: 20, y: 20 } });
  if (!(await tunerTrials.getByText(/32 of 32 shown in graphs/).count()))
    throw new Error(
      "Clicking the history background did not restore all trials.",
    );
  await page.getByRole("button", { name: "Open studies sidebar" }).click();
  await page
    .getByRole("button", { name: "SAC · simulated Optuna study" })
    .click();
  await capture("magictuner-sac-overview-desktop");
  await page
    .getByRole("button", { name: "A2C · simulated Optuna study" })
    .click();
  await capture("magictuner-a2c-overview-desktop");
  await page
    .getByRole("button", { name: "PPO · simulated Optuna study" })
    .click();
  await page
    .getByRole("button", { name: "Close studies sidebar", exact: true })
    .click();
  await captureScrolledHeader(
    ".tuner-main",
    "magictuner-overview-scrolled-desktop",
  );
  await page.locator(".tuner-history-card").scrollIntoViewIfNeeded();
  await capture("magictuner-history-desktop");
  await page.locator(".tuner-plot-card").first().scrollIntoViewIfNeeded();
  await page.locator(".tuner-plot-card").first().hover();
  await capture("magictuner-plot-controls-desktop");
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("dark");
  await page.locator(".tuner-plot-card").first().hover();
  await capture("magictuner-plot-controls-dark-desktop");
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("light");
  await page.getByRole("button", { name: "Zoom in Batch size" }).click();
  await page.getByRole("button", { name: "Reset zoom Batch size" }).click();
  await page.getByRole("button", { name: "Options for Batch size" }).click();
  const tunerCsvDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download CSV" }).click();
  const tunerCsv = await tunerCsvDownload;
  if (tunerCsv.suggestedFilename() !== "batch-size-trials.csv")
    throw new Error("Tuner CSV download failed.");
  await page.getByRole("button", { name: "Options for Batch size" }).click();
  const tunerSvgDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download SVG" }).click();
  const tunerSvg = await tunerSvgDownload;
  const tunerSvgBytes = await readFile(await tunerSvg.path());
  if (
    tunerSvg.suggestedFilename() !== "batch-size-trials.svg" ||
    !tunerSvgBytes.toString().includes("<svg")
  )
    throw new Error("Tuner SVG download failed.");
  await page.getByRole("button", { name: "Options for Batch size" }).click();
  const tunerPngDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download PNG" }).click();
  const tunerPng = await tunerPngDownload;
  const tunerPngBytes = await readFile(await tunerPng.path());
  if (
    tunerPng.suggestedFilename() !== "batch-size-trials.png" ||
    tunerPngBytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  )
    throw new Error("Tuner PNG download failed.");
  await page
    .getByRole("button", { name: "Move Batch size panel" })
    .dragTo(page.locator('.tuner-plot-card[data-metric="dropout"]'));
  if (
    (await page
      .locator(".tuner-plot-card")
      .first()
      .getAttribute("data-metric")) !== "dropout"
  )
    throw new Error("Tuner panel reorder failed.");
  const plotBeforeResize = await page
    .locator('.tuner-plot-card[data-metric="dropout"]')
    .boundingBox();
  const resizeHandle = page.getByRole("button", {
    name: "Resize dropout panel",
  });
  const resizeBox = await resizeHandle.boundingBox();
  if (!plotBeforeResize || !resizeBox)
    throw new Error("Tuner panel resize handle missing.");
  await page.mouse.move(
    resizeBox.x + resizeBox.width / 2,
    resizeBox.y + resizeBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    resizeBox.x + resizeBox.width / 2 + 80,
    resizeBox.y + resizeBox.height / 2 + 60,
    { steps: 5 },
  );
  await page.mouse.up();
  const plotAfterResize = await page
    .locator('.tuner-plot-card[data-metric="dropout"]')
    .boundingBox();
  if (!plotAfterResize || plotAfterResize.height <= plotBeforeResize.height)
    throw new Error("Tuner panel resize failed.");
  const otherPlotAfterResize = await page
    .locator('.tuner-plot-card[data-metric="batch_size"]')
    .boundingBox();
  if (
    !otherPlotAfterResize ||
    Math.abs(otherPlotAfterResize.width - plotAfterResize.width) > 1 ||
    Math.abs(otherPlotAfterResize.height - plotAfterResize.height) > 1
  )
    throw new Error("Tuner parameter graphs did not resize together.");
  await capture("magictuner-panels-reordered-resized-desktop");
  await resizeHandle.focus();
  await page.keyboard.press("ArrowLeft");
  const narrowerPlot = await page
    .locator('.tuner-plot-card[data-metric="dropout"]')
    .boundingBox();
  if (!narrowerPlot || narrowerPlot.width >= plotAfterResize.width)
    throw new Error("Tuner graph width did not adjust by keyboard.");
  await capture("magictuner-three-columns-desktop");
  await page.keyboard.press("Home");
  const restoredPlot = await page
    .locator('.tuner-plot-card[data-metric="dropout"]')
    .boundingBox();
  if (!restoredPlot || restoredPlot.height >= plotAfterResize.height)
    throw new Error("Tuner graph default dimensions were not restored.");
  await page.getByRole("button", { name: "All charts" }).click();
  await page.getByRole("heading", { name: "Charts", exact: true }).waitFor();
  if (await page.locator(".tuner-chart-controls").count())
    throw new Error("The separate chart study bar is still visible.");
  await page.getByRole("button", { name: "Open studies sidebar" }).click();
  if (
    !(await page
      .getByRole("button", { name: "PPO · simulated Optuna study" })
      .getAttribute("aria-current"))
  )
    throw new Error("Charts did not retain the selected overview study.");
  await page.waitForTimeout(350);
  await capture("magictuner-charts-sidebar-desktop");
  await page.getByRole("button", { name: "Study overview" }).click();
  await page.getByRole("heading", { name: /Overview/ }).waitFor();
  if (!(await page.getByRole("complementary", { name: "Studies" }).isVisible()))
    throw new Error("The studies sidebar did not persist across tuning views.");
  await page.getByRole("button", { name: "All charts" }).click();
  await page.getByRole("heading", { name: "Charts", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Close studies sidebar" })
    .first()
    .click();
  await page.waitForTimeout(350);
  await capture("magictuner-charts-desktop");
  await captureScrolledHeader(
    ".tuner-chart-workspace .tuner-main",
    "magictuner-charts-scrolled-desktop",
  );
  await page.getByRole("button", { name: "Study selection" }).click();

  await page.getByRole("button", { name: "MagicAlgo", exact: true }).click();
  await page.locator(".algo-selection-table").waitFor();
  await page.getByRole("radio", { name: "Select PPO Unversioned" }).waitFor();
  await page.getByRole("radio", { name: "Select SAC Unversioned" }).waitFor();
  if (await page.getByPlaceholder("Search algorithms").count()) {
    throw new Error("Algorithm search is still visible.");
  }
  if (
    await page
      .locator(".algo-selection-table tbody tr td:nth-child(2) button")
      .count()
  )
    throw new Error("Algorithm names should be plain text.");
  await capture("magicalgo-selection-desktop");
  await page
    .locator(".algo-selection-table tbody tr")
    .filter({ hasText: "PPO" })
    .filter({ hasText: "Unversioned" })
    .locator("td:nth-child(3)")
    .click();
  if (
    !(await page
      .getByRole("radio", { name: "Select PPO Unversioned" })
      .isChecked())
  )
    throw new Error("Clicking the algorithm row did not select PPO.");
  await capture("magicalgo-row-selected-desktop");
  await page.locator('[aria-controls="algo-filter-board"]').click();
  if ((await page.locator(".algo-selection-table thead th").count()) !== 4)
    throw new Error("Algorithm table did not switch to its displayed filters.");
  await verifyFilterColumnDrag(
    "Algorithm filters",
    "Version",
    "Algorithm",
    ".algo-selection-table th.algo-algorithm-column",
    "magicalgo-filter-column-drag-desktop",
  );
  if (
    !(
      await page.locator(".algo-selection-table th:nth-child(2)").innerText()
    ).includes("VERSION")
  )
    throw new Error("Algorithm table columns did not follow filter order.");
  await page
    .getByLabel("Algorithm filters")
    .getByText("PPO", { exact: true })
    .click();
  if ((await page.locator(".algo-selection-table tbody tr").count()) !== 2)
    throw new Error("Algorithm filter did not isolate PPO.");
  await page
    .locator(
      '.algo-selection-table th.filter-column-active .filter-column-selection[aria-label="Filtered by Algorithm: PPO"]',
    )
    .waitFor();
  if (
    (await page
      .locator(".algo-selection-table tbody td.filter-cell-selected")
      .count()) !== 2
  )
    throw new Error("Filtered algorithm cell is not highlighted.");
  await capture("magicalgo-filtered-column-desktop");
  await page
    .getByLabel("Algorithm filters")
    .getByRole("button", { name: "Clear all" })
    .click();
  if ((await page.locator(".algo-selection-table thead th").count()) !== 3)
    throw new Error("Algorithm table retained columns after clearing filters.");
  await page.locator('[aria-controls="algo-filter-board"]').click();
  if ((await page.locator(".algo-selection-table thead th").count()) !== 5)
    throw new Error("Algorithm table did not restore its information columns.");
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("dark");
  await capture("magicalgo-selection-dark-desktop");
  await page
    .getByRole("combobox", { name: "Dashboard theme" })
    .selectOption("light");

  await captureAlgorithm("A2C", "Advantage Actor-Critic");
  await captureAlgorithm("PPO", "Proximal Policy Optimization");
  await captureAlgorithm("SAC", "Soft Actor-Critic");
  await verifyAlgorithmComparison();

  await page.setViewportSize({ width: 390, height: 844 });
  await capture("magicalgo-selection-mobile");
  await page.locator('[aria-controls="algo-filter-board"]').click();
  await page
    .getByLabel("Algorithm filters")
    .locator(".filter-add-button")
    .click();
  await page
    .getByLabel("Algorithm filters")
    .getByRole("button", { name: /Algorithm.*options/ })
    .click();
  await page
    .getByLabel("Algorithm filters")
    .getByText("PPO", { exact: true })
    .click();
  await capture("magicalgo-filtered-column-mobile");
  await page
    .getByLabel("Algorithm filters")
    .getByRole("button", { name: "Clear all" })
    .click();
  await page.locator('[aria-controls="algo-filter-board"]').click();
  await page.getByRole("radio", { name: "Select PPO Unversioned" }).check();
  await page.getByRole("button", { name: "Mathematical algorithm" }).click();
  await page
    .getByRole("heading", { name: "Algorithm 1: Proximal Policy Optimization" })
    .waitFor();
  await assertAlgorithmFitsViewport();
  await capture("magicalgo-ppo-top-mobile");
  await page
    .locator(".algo-selector")
    .getByRole("button", { name: "Close algorithms sidebar" })
    .click();
  if (await page.locator(".algo-selector").count())
    throw new Error("Mobile algorithm sidebar stayed visible after closing.");
  await capture("magicalgo-ppo-sidebar-closed-mobile");
  await page.getByRole("button", { name: "Open algorithms sidebar" }).click();
  await page.locator(".algo-selector").waitFor();
  await capture("magicalgo-ppo-sidebar-reopened-mobile");
  await page
    .locator('.algo-pseudocode li[data-depth="2"]')
    .first()
    .scrollIntoViewIfNeeded();
  await capture("magicalgo-ppo-nested-mobile");
  await page
    .getByRole("heading", { name: "Notation" })
    .scrollIntoViewIfNeeded();
  await capture("magicalgo-ppo-notation-mobile");
  await page.getByRole("button", { name: "MagicTuner", exact: true }).click();
  await page.getByRole("heading", { name: /Study selection/ }).waitFor();
  await capture("magictuner-selection-mobile");
  await page.locator('[aria-controls="tuner-filter-board"]').click();
  await page.getByLabel("Study filters").locator(".filter-add-button").click();
  await page
    .getByLabel("Study filters")
    .getByRole("button", { name: /Study.*options/ })
    .click();
  await page
    .getByLabel("Study filters")
    .getByText("SAC · simulated Optuna study", { exact: true })
    .click();
  await capture("magictuner-filtered-column-mobile");
  await page
    .getByLabel("Study filters")
    .getByRole("button", { name: "Clear all" })
    .click();
  await page.locator('[aria-controls="tuner-filter-board"]').click();
  await page.getByRole("button", { name: "Study overview" }).click();
  await page.getByRole("heading", { name: /Overview/ }).waitFor();
  await capture("magictuner-overview-mobile");
  await page.locator(".tuner-trials").scrollIntoViewIfNeeded();
  await capture("magictuner-trials-mobile");
  await verifyTunerTrialSync("mobile");
  await page
    .locator(".tuner-trials")
    .getByRole("button", { name: "Trial", exact: true })
    .click();
  await capture("magictuner-trials-sorted-mobile");
  await page.getByRole("button", { name: "Open studies sidebar" }).click();
  await page
    .getByRole("button", { name: "SAC · simulated Optuna study" })
    .click();
  await page
    .getByRole("button", { name: "Close studies sidebar", exact: true })
    .click();
  await capture("magictuner-sac-overview-mobile");
  await page.getByRole("button", { name: "Open studies sidebar" }).click();
  await page
    .getByRole("button", { name: "A2C · simulated Optuna study" })
    .click();
  await page
    .getByRole("button", { name: "Close studies sidebar", exact: true })
    .click();
  await capture("magictuner-a2c-overview-mobile");
  await page.getByRole("button", { name: "Open studies sidebar" }).click();
  await page
    .getByRole("button", { name: "PPO · simulated Optuna study" })
    .click();
  await page
    .getByRole("button", { name: "Close studies sidebar", exact: true })
    .click();
  await page.locator(".tuner-history-card").scrollIntoViewIfNeeded();
  await capture("magictuner-history-mobile");
  await page.getByRole("button", { name: "Open studies sidebar" }).click();
  await capture("magictuner-studies-sidebar-mobile");
  await page
    .getByRole("button", { name: "Close studies sidebar", exact: true })
    .click();
  await page.locator(".tuner-plot-card").first().scrollIntoViewIfNeeded();
  const mobilePlot = page.locator(".tuner-plot-card .recharts-surface").first();
  const mobilePlotBox = await mobilePlot.boundingBox();
  if (!mobilePlotBox || mobilePlotBox.height < 200)
    throw new Error("Tuner parameter graph is not visible on mobile.");
  await capture("magictuner-parameter-plot-mobile");
  await page.getByRole("button", { name: "All charts" }).click();
  await page.getByRole("heading", { name: "Charts", exact: true }).waitFor();
  await page.waitForTimeout(350);
  await capture("magictuner-charts-mobile");
  await page.getByRole("button", { name: "Open studies sidebar" }).click();
  await page.waitForTimeout(350);
  await capture("magictuner-charts-sidebar-mobile");
  await page
    .getByRole("button", { name: "Close studies sidebar" })
    .first()
    .click();
  await page.getByRole("button", { name: "MagicPlot", exact: true }).click();
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page.getByRole("heading", { name: "Workspace", exact: true }).waitFor();
  await capture("magicplot-workspace-mobile");
  await captureScrolledHeader(
    ".panels-area",
    "magicplot-workspace-scrolled-mobile",
  );
  await page.getByRole("button", { name: "Ablations", exact: true }).click();
  await page.getByRole("heading", { name: "Ablations", exact: true }).waitFor();
  await capture("magicplot-ablations-mobile");
  await page
    .getByRole("button", { name: "Runs selection", exact: true })
    .click();
  await page.getByRole("heading", { name: /Runs/ }).waitFor();
  await capture("magicplot-runs-mobile");
  await capture("magicplot-group-filter-mobile");
  await page
    .getByLabel("Run filters")
    .getByText("PPO", { exact: true })
    .click();
  await page
    .locator(".selection-table-runs .selection-table-scroll")
    .evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
  await capture("magicplot-filtered-column-mobile");
  await page
    .getByLabel("Run filters")
    .getByRole("button", { name: "Reset" })
    .click();
  await page.getByRole("button", { name: "Tables", exact: true }).click();
  await page.locator(".scalar-panel-scroll table").first().waitFor();
  await capture("magicplot-tables-mobile");
  await page
    .getByRole("button", { name: "Download Result comparison" })
    .click();
  await capture("magicplot-table-download-mobile");
  await page.getByRole("button", { name: "Edit Result comparison" }).click();
  await capture("magicplot-table-uncertainty-settings-mobile");
  report.passed =
    report.pageErrors.length === 0 && report.consoleErrors.length === 0;
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  try {
    await capture("failure");
  } catch {
    // Keep the original failure.
  }
} finally {
  await browser.close();
  await writeFile(
    path.join(outputDirectory, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

if (!report.passed) process.exitCode = 1;
