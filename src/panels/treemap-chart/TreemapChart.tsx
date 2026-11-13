import { PanelPlugin } from "@perses-dev/plugin-system";
import { TreemapChartComponent } from "./TreemapChartComponent";
import {
  TreemapChartOptions,
  TreemapChartProps,
  createInitialTreemapChartOptions,
} from "./treemap-chart-types";
import { TreemapChartSettingsEditor } from "./TreemapChartSettingsEditor";

/** Treemap: nested boxes sized by value, one level per label, with drill-down. Over a time-series query. */
export const TreemapChart: PanelPlugin<TreemapChartOptions, TreemapChartProps> =
  {
    PanelComponent: TreemapChartComponent,
    panelOptionsEditorComponents: [
      { label: "Settings", content: TreemapChartSettingsEditor },
    ],
    supportedQueryTypes: ["TimeSeriesQuery"],
    createInitialOptions: createInitialTreemapChartOptions,
  };
