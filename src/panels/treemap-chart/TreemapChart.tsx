import type { PanelPlugin } from "@perses-dev/plugin-system";

import type {
  TreemapChartOptions,
  TreemapChartProps,
} from "./treemap-chart-types";
import { TreemapChartComponent } from "./TreemapChartComponent";
import { TreemapChartSettingsEditor } from "./TreemapChartSettingsEditor";

export const TreemapChart: PanelPlugin<TreemapChartOptions, TreemapChartProps> =
  {
    PanelComponent: TreemapChartComponent,
    panelOptionsEditorComponents: [
      { label: "Settings", content: TreemapChartSettingsEditor },
    ],
    supportedQueryTypes: ["TimeSeriesQuery"],
    createInitialOptions: () => ({}),
  };
