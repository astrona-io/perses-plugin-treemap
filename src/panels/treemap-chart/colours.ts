import {
  formatValue,
  type FormatOptions,
  type ThresholdOptions,
} from "@perses-dev/components";

/** Stable palette index for a name, so a team keeps its colour across refreshes (as in the Sankey plugin). */
export function hashIndex(name: string, size: number): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % Math.max(1, size);
}

/** `color` with alpha `a`, for `#rgb`, `#rrggbb` and `rgb()`; anything else comes back unchanged. */
export function withAlpha(color: string, a: number): string {
  const c = color.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m && m[1]) {
    const [r, g, b] = [...m[1]].map((h) => parseInt(h + h, 16));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(c);
  if (m && m[1]) {
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c);
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${a})`;
  return c;
}

function parseRgb(color: string): [number, number, number] | undefined {
  const c = color.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m && m[1]) {
    const [r, g, b] = [...m[1]].map((h) => parseInt(h + h, 16));
    return [r as number, g as number, b as number];
  }
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(c);
  if (m && m[1]) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return undefined;
}

/**
 * `color` blended into `background`: weight 1 is `color`, 0 is `background`. Opaque, so nested
 * boxes do not stack tints (ECharts paints a parent's frame under its children). Unparseable
 * colours come back unchanged.
 */
export function mix(color: string, background: string, weight: number): string {
  const a = parseRgb(color);
  const b = parseRgb(background);
  if (!a || !b) return color;
  const ch = (i: number): number =>
    Math.round(a[i]! * weight + b[i]! * (1 - weight));
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
}

export interface ThresholdBand {
  /** 0 below the first step, i + 1 at or above step i. */
  index: number;
  color: string;
  /** The step's name, or "≥ value". Shown in the tooltip and legend, so colour is never the only cue. */
  label: string;
}

export interface ThresholdColours {
  defaultColor: string;
  palette: string[];
}

/**
 * The threshold band of a value. In `percent` mode the value compared is the box's share of
 * `total`, in percent. The same step logic as the Honeycomb plugin.
 */
export function thresholdBand(
  value: number,
  total: number,
  thresholds: ThresholdOptions | undefined,
  format: FormatOptions,
  theme: ThresholdColours,
): ThresholdBand {
  const steps = [...(thresholds?.steps ?? [])].sort(
    (a, b) => a.value - b.value,
  );
  const percent = thresholds?.mode === "percent";
  const scaled = percent ? (total > 0 ? (value / total) * 100 : 0) : value;
  const fmt = (v: number): string =>
    percent ? `${v}% of total` : formatValue(v, format);
  let band: ThresholdBand = {
    index: 0,
    color: thresholds?.defaultColor ?? theme.defaultColor,
    label: steps[0] ? `< ${fmt(steps[0].value)}` : "Value",
  };
  steps.forEach((step, i) => {
    if (scaled >= step.value) {
      band = {
        index: i + 1,
        color:
          step.color ??
          theme.palette[i % Math.max(1, theme.palette.length)] ??
          theme.defaultColor,
        label: step.name ?? `≥ ${fmt(step.value)}`,
      };
    }
  });
  return band;
}

/** Every band of the thresholds, lowest first, for the legend. */
export function thresholdBands(
  thresholds: ThresholdOptions | undefined,
  format: FormatOptions,
  theme: ThresholdColours,
): ThresholdBand[] {
  const steps = [...(thresholds?.steps ?? [])].sort(
    (a, b) => a.value - b.value,
  );
  const percent = thresholds?.mode === "percent";
  const fmt = (v: number): string =>
    percent ? `${v}% of total` : formatValue(v, format);
  const bands: ThresholdBand[] = [
    {
      index: 0,
      color: thresholds?.defaultColor ?? theme.defaultColor,
      label: steps[0] ? `< ${fmt(steps[0].value)}` : "Value",
    },
  ];
  steps.forEach((step, i) =>
    bands.push({
      index: i + 1,
      color:
        step.color ??
        theme.palette[i % Math.max(1, theme.palette.length)] ??
        theme.defaultColor,
      label: step.name ?? `≥ ${fmt(step.value)}`,
    }),
  );
  return bands;
}
