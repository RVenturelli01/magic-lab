import { paperFigure } from "../paper-figure.mjs";
import { directExport } from "../../reporting/direct-export.mjs";
export function createExportService(state, { document, fetch, Plotly, toast }) {
  let renderQueue = Promise.resolve();
  function download(data, name, type) {
    const url = URL.createObjectURL(new Blob([data], { type })),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function paperImage(chart, format) {
    const figure = paperFigure(chart),
      target = document.createElement("div");
    document.body.append(target);
    target.style.cssText = "position:fixed;left:-10000px;top:0";
    try {
      await Plotly.newPlot(target, figure.traces, figure.layout, {
        staticPlot: true,
      });
      const url = await Plotly.toImage(target, {
        format,
        width: Math.round(figure.layout.width),
        height: Math.round(figure.layout.height),
        scale: format === "png" ? chart.view.paper.dpi / 96 : 1,
      });
      return new Uint8Array(await (await fetch(url)).arrayBuffer());
    } finally {
      Plotly.purge(target);
      target.remove();
    }
  }
  async function buildExportFiles(
    format,
    {
      metricId,
      view = state.view,
      dataset = state.dataset,
      mode = state.exportMode,
      signal,
    } = {},
  ) {
    signal?.throwIfAborted();
    return directExport(dataset, structuredClone(view), {
      format,
      metricId,
      mode,
      renderSVG: async (chart) => {
        const task = renderQueue.then(async () => {
          signal?.throwIfAborted();
          const data = await paperImage(chart, "svg");
          signal?.throwIfAborted();
          return new TextDecoder().decode(data);
        });
        renderQueue = task.catch(() => {});
        return task;
      },
      rasterize,
    });
  }
  async function exportAnalysis(format, metricId) {
    const files = await buildExportFiles(format, { metricId });
    for (const file of files) download(file.data, file.name, file.type);
    toast("Export ready");
  }
  async function rasterize(svg, { format, dpi = 300, widthCm, heightCm }) {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      const scale = dpi / 96;
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      if (canvas.width * canvas.height > 100000000)
        throw Error("Figure too large; reduce DPI or export separate files");
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((r) =>
        canvas.toBlob(r, format === "pdf" ? "image/jpeg" : "image/png", 0.98),
      );
      if (!blob) throw Error("Image encoding failed");
      return {
        bytes: new Uint8Array(await blob.arrayBuffer()),
        width: canvas.width,
        height: canvas.height,
        widthPt: (widthCm / 2.54) * 72,
        heightPt: (heightCm / 2.54) * 72,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return { exportAnalysis, buildExportFiles };
}
