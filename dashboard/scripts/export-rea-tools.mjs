/**
 * Export dashboard-relevant REA MCP input schemas from the installed 6.8.0 server.
 * This only performs initialize and tools/list; it never opens a browser.
 */
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const dashboardRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const reaRoot = path.resolve(dashboardRoot, "..", "tooling", "rea");
const entry = path.join(
  reaRoot,
  "node_modules",
  "rea-agents",
  "scripts",
  "rea.mjs",
);
const output = path.join(dashboardRoot, "docs", "REA_TOOLS.json");

const selected = [
  [
    "list_browser_targets",
    "Find the exact dashboard tab on a loopback Chrome CDP endpoint.",
  ],
  [
    "inspect_web_page",
    "Read DOM, accessibility, resources, and console metadata without changing the page.",
  ],
  [
    "capture_web_screenshot",
    "Capture the current viewport of an already selected Chrome tab.",
  ],
  [
    "capture_browser_scenario",
    "Navigate and click through a repeatable browser scenario with screenshots and state checks.",
  ],
  [
    "observe_web_session",
    "Record a session while the user performs interactions in an existing browser.",
  ],
  [
    "compare_web_screenshots",
    "Compare two captured screenshots when checking a visual change.",
  ],
  [
    "compare_web_captures",
    "Compare two passive captures or scenario results for state and behavior changes.",
  ],
  [
    "inspect_web_event_listeners",
    "Locate handlers for a control that appears unresponsive.",
  ],
  [
    "observe_web_execution",
    "Measure execution coverage while reproducing a runtime problem.",
  ],
  [
    "inspect_web_network_capture",
    "Inspect a saved HAR or other supported network capture for data-loading problems.",
  ],
  [
    "inspect_analysis_view",
    "Page through selected details of retained REA Evidence without rerunning a capture.",
  ],
  [
    "analyze_web_bundle",
    "Inspect a shipped production web bundle when source code is unavailable.",
  ],
];

const server = spawn(process.execPath, [entry, "mcp"], {
  cwd: reaRoot,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});
const pending = new Map();
let nextId = 0;
let stderr = "";
server.stderr.setEncoding("utf8");
server.stderr.on("data", (chunk) => {
  stderr = (stderr + chunk).slice(-4000);
});
const lines = createInterface({ input: server.stdout });
lines.on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  const waiting = pending.get(message.id);
  if (!waiting) return;
  pending.delete(message.id);
  if (message.error) waiting.reject(new Error(JSON.stringify(message.error)));
  else waiting.resolve(message.result);
});
server.on("exit", (code) => {
  for (const waiting of pending.values()) {
    waiting.reject(new Error("REA exited (" + code + "): " + stderr));
  }
  pending.clear();
});

function request(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    server.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n",
    );
  });
}

const deadline = setTimeout(() => {
  for (const waiting of pending.values()) {
    waiting.reject(new Error("REA tools/list timed out after 30 seconds."));
  }
  pending.clear();
  server.kill();
}, 30_000);

try {
  await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "magic-lab-rea-export", version: "0.1.0" },
  });
  server.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) +
      "\n",
  );
  const advertised = [];
  let cursor;
  do {
    const page = await request("tools/list", cursor ? { cursor } : {});
    advertised.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);

  const byName = new Map(advertised.map((tool) => [tool.name, tool]));
  const missing = selected
    .map(([name]) => name)
    .filter((name) => !byName.has(name));
  if (missing.length)
    throw new Error("REA did not advertise: " + missing.join(", "));
  const packageJson = JSON.parse(
    await readFile(
      path.join(reaRoot, "node_modules", "rea-agents", "package.json"),
      "utf8",
    ),
  );
  const catalog = {
    source: "rea-agents MCP tools/list",
    reaVersion: packageJson.version,
    scope:
      "Tools useful for dashboard visual verification and focused browser debugging",
    tools: selected.map(([name, when]) => ({
      name,
      mcpName: "mcp__rea__" + name,
      when,
      inputSchema: byName.get(name).inputSchema,
    })),
  };
  await writeFile(output, JSON.stringify(catalog, null, 2) + "\n");
  process.stdout.write(
    "Exported " + catalog.tools.length + " tools to " + output + "\n",
  );
} finally {
  clearTimeout(deadline);
  server.stdin.end();
  const cleanup = setTimeout(() => server.kill(), 2000);
  cleanup.unref();
  server.once("exit", () => clearTimeout(cleanup));
}
