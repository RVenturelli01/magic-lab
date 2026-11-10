export type PanelLayout = { span: number; height: number };
export type UniformPanelLayout = { columns: number; height: number };

export const PANEL_GRID_UNITS = 12;
export const MIN_PANEL_HEIGHT = 280;
export const MAX_PANEL_HEIGHT = 1200;
export const DEFAULT_PANEL_HEIGHT = 465;
export const MAX_PANEL_COLUMNS = 6;

export function resizedUniformPanelLayout(
  start: { width: number; height: number; columns: number },
  delta: { x: number; y: number },
  gridWidth: number,
  gap: number,
  narrow = false,
): UniformPanelLayout {
  const maximum = Math.max(
    1,
    Math.min(MAX_PANEL_COLUMNS, Math.floor((gridWidth + gap) / (240 + gap))),
  );
  const requestedWidth = Math.max(240, start.width + delta.x);
  return {
    columns:
      narrow || Math.abs(delta.x) < 8
        ? start.columns
        : Math.max(
            1,
            Math.min(
              maximum,
              Math.round((gridWidth + gap) / (requestedWidth + gap)),
            ),
          ),
    height: Math.round(
      Math.max(
        MIN_PANEL_HEIGHT,
        Math.min(MAX_PANEL_HEIGHT, start.height + delta.y),
      ),
    ),
  };
}

export function restorePanelLayout(value: unknown): PanelLayout | null {
  if (!value || typeof value !== "object") return null;
  const { span, height } = value as Partial<PanelLayout>;
  return typeof span === "number" &&
    Number.isInteger(span) &&
    span >= 3 &&
    span <= PANEL_GRID_UNITS &&
    typeof height === "number" &&
    Number.isFinite(height) &&
    height >= MIN_PANEL_HEIGHT &&
    height <= MAX_PANEL_HEIGHT
    ? { span, height: Math.round(height) }
    : null;
}

export function resizedPanelLayout(
  start: { width: number; height: number },
  delta: { x: number; y: number },
  gridWidth: number,
  gap: number,
  narrow = false,
): PanelLayout {
  const unit = (gridWidth + gap) / PANEL_GRID_UNITS;
  const minimum = Math.min(
    PANEL_GRID_UNITS,
    Math.max(3, Math.ceil((240 + gap) / unit)),
  );
  return {
    span: narrow
      ? PANEL_GRID_UNITS
      : Math.max(
          minimum,
          Math.min(
            PANEL_GRID_UNITS,
            Math.round((start.width + delta.x + gap) / unit),
          ),
        ),
    height: Math.round(
      Math.max(
        MIN_PANEL_HEIGHT,
        Math.min(MAX_PANEL_HEIGHT, start.height + delta.y),
      ),
    ),
  };
}
