import { createApplication } from "../../web/application/application.mjs";
import { defaultView } from "../../core/view.mjs";

export function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
export function testApplication(
  dataset,
  storage = memoryStorage(),
  overrides = {},
) {
  const handlers = {},
    notices = [];
  const el = {
    innerHTML: "",
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (name, fn) => (handlers[name] = fn),
    removeEventListener: (name) => delete handlers[name],
  };
  const document = {
    querySelector: (selector) => (selector === "#app" ? el : null),
    querySelectorAll: () => [],
    body: { append: (element) => notices.push(element) },
    createElement: () => ({ remove() {} }),
  };
  const application = createApplication({
    el,
    document,
    localStorage: storage,
    fetch: async () => ({ ok: true, json: async () => dataset }),
    prompt: () => null,
    ...overrides,
  });
  application.state.dataset = dataset;
  application.state.view = defaultView(dataset);
  return { ...application, handlers, el, notices, storage };
}
