import { createLabRouter } from "./application/router.mjs";

const application = createLabRouter({
  el: document.querySelector("#app"),
  document,
  localStorage,
  fetch: globalThis.fetch.bind(globalThis),
  prompt: globalThis.prompt.bind(globalThis),
  Plotly: globalThis.Plotly,
  window,
});
await application.start();
