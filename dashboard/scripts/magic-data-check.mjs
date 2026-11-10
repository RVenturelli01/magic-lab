import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { launchBrowser } from "./browser-check.mjs";

const directory = "outputs/magic-data-check";
await mkdir(directory, { recursive: true });
const browser = await launchBrowser();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const capture = async (name) => {
    await page.locator(".panels-scroll").evaluateAll((elements) =>
      elements.forEach((element) => {
        element.style.scrollBehavior = "auto";
        element.scrollTop = 0;
      }),
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${directory}/${name}.png` });
  };
  await page.goto(process.env.DASHBOARD_URL ?? "http://127.0.0.1:5173");
  await page.getByRole("button", { name: "MagicData", exact: true }).click();
  await page
    .getByRole("radio", { name: "Select classification-demo.csv" })
    .check();
  assert.equal(await page.getByRole("radio").count(), 3);
  await capture("samples-selection-desktop");
  await page.getByRole("button", { name: "Data viewer", exact: true }).click();
  await page
    .getByText("Deterministic synthetic sample data", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Remove dataset" }).isDisabled(),
    true,
  );
  await capture("samples-viewer-desktop");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("region", { name: "Dataset rows", exact: true })
    .getByText("CLS-0051", { exact: true })
    .waitFor();
  for (const name of ["regression-demo.json", "rl-transitions-demo.json"]) {
    await page.getByRole("option", { name: new RegExp(name) }).click();
    await page.getByRole("heading", { name, exact: true }).waitFor();
  }
  await page.getByLabel("Dashboard theme").selectOption("dark");
  await capture("samples-viewer-dark");
  await page.getByLabel("Dashboard theme").selectOption("light");
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("samples-viewer-mobile");
  await page
    .getByRole("button", { name: "Data selection", exact: true })
    .click();
  await capture("samples-selection-mobile");
  await page.setViewportSize({ width: 1440, height: 900 });
  const upload = (name, text) =>
    page.getByLabel("Import dataset file").setInputFiles({
      name,
      mimeType: "text/plain",
      buffer: Buffer.from(text),
    });
  await upload("invalid.csv", "a,b\n1");
  await page.getByRole("alert").filter({ hasText: "expected 2" }).waitFor();
  await upload(
    "measurements.csv",
    "id,value,group\n" +
      Array.from(
        { length: 65 },
        (_, i) =>
          `${String(i).padStart(3, "0")},${i === 2 ? "" : i},${i % 2 ? "test" : "train"}`,
      ).join("\n"),
  );
  await page.getByRole("radio", { name: "Select measurements.csv" }).waitFor();
  await upload(
    "labels.json",
    '[{"label":"cat","score":0.8},{"label":"dog","score":null}]',
  );
  await page.getByRole("radio", { name: "Select labels.json" }).waitFor();
  await page.getByLabel("Search datasets").fill("nothing");
  await page.getByText("No datasets match this search.").waitFor();
  await page.getByLabel("Search datasets").fill("");
  await page.getByRole("radio", { name: "Select measurements.csv" }).check();
  await capture("selection-desktop");
  await page.getByRole("button", { name: "Data viewer", exact: true }).click();
  await capture("viewer-top-desktop");
  await page
    .getByRole("region", { name: "Dataset rows", exact: true })
    .getByText("000", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("region", { name: "Dataset rows", exact: true })
    .getByText("064", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await capture("viewer-desktop");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  assert.equal((await download).suggestedFilename(), "measurements.json");
  for (const theme of ["dark", "high-contrast"]) {
    await page.getByLabel("Dashboard theme").selectOption(theme);
    await capture(`viewer-${theme}`);
  }
  await page.getByLabel("Dashboard theme").selectOption("light");
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("viewer-mobile");
  await page
    .getByRole("button", { name: "Data selection", exact: true })
    .click();
  await capture("selection-mobile");
  await page.reload();
  await page.getByRole("button", { name: "MagicData", exact: true }).click();
  await page
    .getByRole("button", { name: "Data selection", exact: true })
    .click();
  await page.getByRole("radio", { name: "Select labels.json" }).check();
  await page.getByRole("button", { name: "Data viewer", exact: true }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Remove dataset" }).click();
  await page
    .getByRole("heading", { name: "labels.json", exact: true })
    .waitFor();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove dataset" }).click();
  await page
    .getByRole("option", { name: /labels.json/ })
    .waitFor({ state: "detached" });
  await page.getByRole("option", { name: /measurements.csv/ }).click();
  await page
    .getByRole("heading", { name: "measurements.csv", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "MagicData import, invalid input, search, selection, pagination, export, reload and deletion passed. Captures:",
    directory,
  );
} finally {
  await browser.close();
}
