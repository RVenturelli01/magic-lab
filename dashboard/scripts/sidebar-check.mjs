import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { launchBrowser } from "./browser-check.mjs";

const directory = "outputs/sidebar-check";
await mkdir(directory, { recursive: true });
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.DASHBOARD_URL ?? "http://127.0.0.1:5173");
  for (const [section, view, sidebar] of [
    ["MagicAlgo", "Mathematical algorithm", "algorithms"],
    ["MagicPlot", "Workspace", "runs"],
    ["MagicTuner", "Study overview", "studies"],
    ["MagicTuner", "All charts", "studies"],
    ["MagicData", "Data viewer", "datasets"],
  ]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: section, exact: true }).click();
    await page.getByRole("button", { name: view, exact: true }).click();
    for (const [size, viewport] of [
      ["desktop", { width: 1440, height: 900 }],
      ["mobile", { width: 390, height: 844 }],
    ]) {
      await page.setViewportSize(viewport);
      for (const theme of ["light", "dark-modern"]) {
        await page.getByLabel("Dashboard theme").selectOption(theme);
        const open = page.getByRole("button", {
          name: `Open ${sidebar} sidebar`,
          exact: true,
        });
        const close = page.getByRole("button", {
          name: `Close ${sidebar} sidebar`,
          exact: true,
        });
        await open.or(close).waitFor();
        if (await open.count()) await open.click();
        await close.waitFor();
        await page.evaluate(() => document.fonts.ready);
        const filename = `${section}-${view.replaceAll(" ", "-")}-${size}-${theme}`;
        await page.screenshot({ path: `${directory}/${filename}-open.png` });
        await close.click();
        const rail = page.locator(".collapsed-sidebar");
        await open.waitFor();
        const bounds = await rail.boundingBox();
        const buttonBounds = await open.boundingBox();
        assert.equal(bounds.width, 56);
        assert.ok(
          bounds.height > 200,
          "Collapsed rail must span the content height",
        );
        assert.ok(
          buttonBounds.x >= bounds.x &&
            buttonBounds.x + buttonBounds.width <= bounds.x + bounds.width,
        );
        assert.equal(await close.count(), 0);
        await page.screenshot({ path: `${directory}/${filename}-closed.png` });
        await open.focus();
        await page.keyboard.press("Enter");
        await close.waitFor();
        assert.equal(await rail.count(), 0);
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    `Sidebar close/reopen passed in all four sections, tuner overview/charts, desktop/mobile, light/dark. Captures: ${directory}`,
  );
} catch (error) {
  for (const page of browser.contexts().flatMap((context) => context.pages())) {
    await page.screenshot({ path: `${directory}/failure.png` });
    console.log(await page.getByRole("button").allTextContents());
  }
  throw error;
} finally {
  await browser.close();
}
