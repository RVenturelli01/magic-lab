// Loaded synchronously in <head> so the stored theme applies before first paint.
(() => {
  const key = "rl-observatory.theme.v1";
  const backgrounds = {
    dark: "#202628",
    light: "#f1f4f4",
    blue: "#202630",
    purple: "#282330",
    green: "#202b25",
    amber: "#2d2720",
  };
  const valid = (value) =>
    value === "system" || Object.hasOwn(backgrounds, value);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = "dark";
  try {
    const stored = localStorage.getItem(key);
    if (valid(stored)) preference = stored;
  } catch {}
  function apply() {
    const theme =
      preference === "system" ? (media.matches ? "dark" : "light") : preference;
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", backgrounds[theme]);
  }
  window.observatoryTheme = {
    get: () => preference,
    set(value) {
      if (!valid(value)) throw Error("Unknown theme");
      preference = value;
      apply();
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
  };
  media.addEventListener("change", () => {
    if (preference === "system") apply();
  });
  apply();
})();
