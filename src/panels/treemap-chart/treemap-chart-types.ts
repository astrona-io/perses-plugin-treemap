import type { TimeSeriesData } from "@perses-dev/spec";
import type {
  CalculationType,
  OptionsEditorProps,
  PanelProps,
} from "@perses-dev/plugin-system";
import type { FormatOptions, ThresholdOptions } from "@perses-dev/components";

export type QueryData = TimeSeriesData;

export type TreemapChartProps = PanelProps<TreemapChartOptions, QueryData>;
export type TreemapChartEditorProps = OptionsEditorProps<TreemapChartOptions>;

/** `topLevel`: one colour per first-level box, shared by everything inside it. `thresholds`: each box by its value. */
export type ColorBy = "topLevel" | "thresholds";

export interface TreemapChartOptions {
  /** How each series is reduced to one value. */
  calculation: CalculationType;
  /**
   * Ordered label names, one level of the hierarchy each (1 to 4). Same shape as the Sankey
   * plugin's `levels`. Default `["namespace", "pod"]`.
   */
  levels?: string[];
  format?: FormatOptions;
  /** Default `topLevel`. */
  colorBy?: ColorBy;
  /** Used when `colorBy` is `thresholds`. `percent` mode compares a box's share of the total. */
  thresholds?: ThresholdOptions;
  /** Keep the largest N boxes under each parent, at every level; the rest are summed into "Other". Unset: no limit. */
  topN?: number;
  /** Show the breadcrumb (path and way back up) above the chart. Default true. */
  showBreadcrumb?: boolean;
}

export const DEFAULT_LEVELS = ["namespace", "pod"];
export const MIN_LEVELS = 1;
export const MAX_LEVELS = 4;
export const DEFAULT_COLOR_BY: ColorBy = "topLevel";
export const DEFAULT_SHOW_BREADCRUMB = true;
/** Prometheus label names; the CUE schema enforces the same pattern. */
export const LABEL_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function createInitialTreemapChartOptions(): TreemapChartOptions {
  return {
    calculation: "last",
    levels: [...DEFAULT_LEVELS],
    format: { unit: "decimal" },
    colorBy: DEFAULT_COLOR_BY,
    showBreadcrumb: DEFAULT_SHOW_BREADCRUMB,
  };
}
