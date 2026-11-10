import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

/** Shared browser selection for visual and performance checks. */
export function browserExecutable() {
  const candidates = [
    chromium.executablePath(),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA &&
      path.join(
        process.env.LOCALAPPDATA,
        "Google/Chrome/Application/chrome.exe",
      ),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const executable = process.env.CHROME_PATH ?? candidates.find(existsSync);
  if (!executable || !existsSync(executable))
    throw new Error(
      "Browser not found. Run npm run visual:install or set CHROME_PATH to an existing Chrome executable.",
    );
  return executable;
}

export async function launchBrowser() {
  return chromium.launch({
    executablePath: browserExecutable(),
    headless: true,
  });
}
