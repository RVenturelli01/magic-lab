// Verify MCP initialization and tool discovery only. No analysis tools are called.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(root, 'node_modules/rea-agents/scripts/rea.mjs');
const server = spawn(process.execPath, [entry, 'mcp'], {
  cwd: root,
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});
const pending = new Map();
let buffer = '';
let stderr = '';
let sequence = 0;

function fail(error) {
  for (const request of pending.values()) request.reject(error);
  pending.clear();
}
server.on('error', fail);
server.stdin.on('error', fail);
server.on('exit', (code) => fail(new Error(`REA exited (${code}): ${stderr.slice(-2000)}`)));
server.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-8192); });
server.stdout.setEncoding('utf8');
server.stdout.on('data', (chunk) => {
  buffer += chunk;
  if (buffer.length > 32 * 1024 * 1024) {
    fail(new Error('MCP response exceeded the diagnostic size limit.'));
    server.kill();
    return;
  }
  let end;
  while ((end = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, end).trim();
    buffer = buffer.slice(end + 1);
    if (!line) continue;
    try {
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    } catch (error) { fail(error); }
  }
});

function send(message) {
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
}
function request(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send({ id, method, params });
  });
}

const timeout = setTimeout(() => {
  fail(new Error('MCP diagnostic timed out after 45 seconds.'));
  server.kill();
}, 45_000);

try {
  const initialized = await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'magic-lab-setup-check', version: '0.1.0' },
  });
  send({ method: 'notifications/initialized' });
  const tools = [];
  let cursor;
  do {
    const page = await request('tools/list', cursor ? { cursor } : {});
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  const required = ['list_browser_targets', 'inspect_web_page', 'analyze_web_bundle', 'capture_web_screenshot'];
  const advertised = new Set(tools.map((tool) => tool.name));
  const missing = required.filter((name) => !advertised.has(name));
  if (missing.length) throw new Error(`Missing browser tools: ${missing.join(', ')}`);
  console.log(JSON.stringify({
    healthy: true,
    server: initialized.serverInfo,
    protocolVersion: initialized.protocolVersion,
    toolCount: tools.length,
    browserTools: required,
    analysisToolsCalled: 0,
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  server.stdin.end();
  const cleanup = setTimeout(() => server.kill(), 2000);
  cleanup.unref();
  server.once('exit', () => clearTimeout(cleanup));
}
