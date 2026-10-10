const integers = new Set([
  "columns",
  "legendColumns",
  "markerEvery",
  "errorEvery",
  "dpi",
  "window",
  "minStep",
  "maxStep",
]);
export function scrubValue(
  start,
  dy,
  {
    step = 0.1,
    min = -Infinity,
    max = Infinity,
    integer = false,
    fine = false,
  } = {},
) {
  const speed = fine ? (integer ? step : step / 10) : step * 4;
  const value = start + Math.round(dy / (fine && integer ? 40 : 8)) * speed;
  return Math.min(
    max,
    Math.max(min, integer ? Math.round(value) : Number(value.toPrecision(12))),
  );
}
export function mountNumberScrub(root, { preview = () => {} } = {}) {
  if (!root) return;
  for (const input of root.querySelectorAll('input[type="number"]')) {
    input.classList.add("number-scrub");
    input.title =
      "Drag up / down to adjust · Shift for fine control · Click to type";
    let drag = null;
    const finish = (cancel = false) => {
      if (!drag) return;
      const state = drag;
      drag = null;
      state.popup?.remove();
      input.classList.remove("scrubbing");
      if (input.hasPointerCapture(state.id))
        input.releasePointerCapture(state.id);
      if (state.active) preview(null);
      if (cancel) {
        input.value = state.original;
        return;
      }
      if (state.active && input.value !== state.original)
        input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    input.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey) return;
      const key = input.dataset.paperKey ?? input.id,
        integer = integers.has(key),
        value = Number(input.value || 0);
      if (!Number.isFinite(value)) return;
      const step =
        input.step && input.step !== "any"
          ? Number(input.step)
          : integer
            ? 1
            : ["bandOpacity", "legendOpacity"].includes(key)
              ? 0.01
              : input.dataset.paperScope === "metric"
                ? Math.max(
                    0.000001,
                    10 ** Math.floor(Math.log10(Math.abs(value) || 1)) / 10,
                  )
                : 0.1;
      drag = {
        id: event.pointerId,
        y: event.clientY,
        original: input.value,
        start: value,
        anchor: value,
        anchorY: event.clientY,
        lastY: event.clientY,
        fine: Boolean(event.shiftKey),
        active: false,
        step,
        integer,
        min: input.min === "" ? -Infinity : Number(input.min),
        max: input.max === "" ? Infinity : Number(input.max),
      };
      input.setPointerCapture(event.pointerId);
    });
    input.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dy = drag.y - event.clientY;
      if (!drag.active && Math.abs(dy) < 4) return;
      event.preventDefault();
      if (!drag.active) {
        drag.active = true;
        input.blur();
        input.classList.add("scrubbing");
        drag.popup = root.ownerDocument.createElement("div");
        drag.popup.className = "number-scrub-popup";
        drag.popup.setAttribute("role", "status");
        drag.popup.innerHTML =
          '<div class="scrub-gauge" aria-hidden="true"><span class="scrub-direction">+</span><div class="scrub-track">' +
          Array.from({ length: 9 }, () => '<i class="scrub-tick"></i>').join(
            "",
          ) +
          '<span class="scrub-origin"></span><span class="scrub-thumb"></span></div><span class="scrub-direction">−</span></div><div class="scrub-readout"><strong class="scrub-value"></strong><span class="scrub-delta"></span><span class="scrub-hint"></span></div>';
        root.ownerDocument.body.append(drag.popup);
        const rect = input.getBoundingClientRect(),
          width = root.ownerDocument.documentElement.clientWidth,
          height = root.ownerDocument.documentElement.clientHeight;
        drag.popup.style.left =
          Math.max(8, Math.min(rect.right + 8, width - 160)) + "px";
        drag.popup.style.top =
          Math.max(8, Math.min(rect.top - 60, height - 176)) + "px";
      }
      if (drag.fine !== Boolean(event.shiftKey)) {
        drag.anchor = Number(input.value || 0);
        drag.anchorY = drag.lastY;
        drag.fine = Boolean(event.shiftKey);
      }
      input.value = scrubValue(drag.anchor, drag.anchorY - event.clientY, {
        ...drag,
        fine: drag.fine,
      });
      drag.lastY = event.clientY;
      const value = Number(input.value),
        delta = Number((value - drag.start).toPrecision(12));
      const fraction =
        Number.isFinite(drag.min) &&
        Number.isFinite(drag.max) &&
        drag.max > drag.min
          ? (value - drag.min) / (drag.max - drag.min)
          : 0.5 + Math.tanh(dy / 100) * 0.5;
      const origin =
        Number.isFinite(drag.min) &&
        Number.isFinite(drag.max) &&
        drag.max > drag.min
          ? (drag.start - drag.min) / (drag.max - drag.min)
          : 0.5;
      drag.popup.querySelector(".scrub-thumb").style.top =
        100 - 100 * fraction + "%";
      drag.popup.querySelector(".scrub-origin").style.top =
        100 - 100 * Math.max(0, Math.min(1, origin)) + "%";
      drag.popup.querySelector(".scrub-value").textContent = input.value;
      drag.popup.querySelector(".scrub-delta").textContent =
        (delta > 0 ? "+" : "") + delta;
      drag.popup.querySelector(".scrub-hint").textContent = event.shiftKey
        ? "Fine adjustment"
        : "Shift: fine";
      if (drag.lastValue !== input.value) {
        drag.lastValue = input.value;
        preview(input);
      }
    });
    input.addEventListener("pointerup", () => finish());
    input.addEventListener("pointercancel", () => finish(true));
    input.addEventListener("lostpointercapture", () => finish(true));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drag) {
        event.preventDefault();
        event.stopPropagation();
        finish(true);
      }
    });
  }
}
