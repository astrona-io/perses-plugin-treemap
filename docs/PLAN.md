# Plan

The spec is in [`PROMPT.md`](PROMPT.md), the concept sketch in [`mockup.png`](mockup.png). Decisions
made along the way are in [`DECISIONS.md`](DECISIONS.md).

## Data model

Input: the `TimeSeriesData` of every query on the panel. Each series is reduced to one number with
the panel's Perses `calculation` (`last`, `sum`, `mean`, ...).

`buildTree(results, levels, calculation, topN)` in `src/panels/treemap-chart/data.ts`:

1. For each series, read the label of every level, in order. A missing or empty label becomes
   `(none)`, so the series is kept. The level parsing is the Sankey plugin's.
2. Skip values that are not finite. Count negative values (a treemap cannot draw them) and skip
   them; the panel says how many it skipped.
3. Add the value to every node on the series' path. Series that end up on the same leaf (same
   labels at every level) are summed.
4. Sort the children of each node largest first. With `topN`, keep the largest N under each parent
   and sum the rest into one `Other (k)` node, which records its members (name and value) for the
   tooltip. An Other node of a single box is not made: that box stays itself.
5. Return the root, an index by id (for drill-down and keyboard focus), and counts: series used,
   negative, and without a level label.

```ts
interface TreeNode {
  id: string; // the path joined; unique
  name: string; // label value as shown
  path: string[]; // names from the first level down
  value: number;
  children: TreeNode[];
  other?: { name: string; value: number }[]; // on an Other node
}
```

The tree is memoised on the query results and the options that shape it, so hovering and drilling
never rebuild it.

## Component tree

```
TreemapChart (PanelPlugin)
├── TreemapChartComponent        panel: state, header, footnote, keyboard, aria-live
│   ├── header                   Breadcrumbs ("All" › path) or an "Up" button,
│   │                            threshold legend, total of the current level
│   ├── TreemapCanvas            ECharts treemap (full `echarts` init), click → drill
│   └── footnote                 "(none)" and negative-series counts
└── TreemapChartSettingsEditor   Data (calculation, Top N), Levels, Format,
                                 Display (Color by, Show breadcrumb), Thresholds
```

The ECharts option is built from the current node only: two depths below it, labels hidden on
boxes too small to hold them (they show on hover), the ECharts breadcrumb and its own drill-down
turned off. Drilling is panel state, so the header, total and keyboard focus follow it.

Colours:

- `topLevel` (default): one palette colour per outermost box of the current view, in name order,
  from the Perses chart theme; everything inside it shares the colour. Parents and leaves are the
  colour mixed into the panel background (opaque), with a stronger border.
- `thresholds`: each box by the Perses threshold step its value is in. In percent mode the value
  compared is the box's share of the total. The header shows a legend with the step names, and the
  tooltip names the step, so colour is never the only cue.

## Schema

`schemas/panels/treemap-chart/treemap-chart.cue`, kind `TreemapChart`:

| Option           | Type                          | Default                |
| ---------------- | ----------------------------- | ---------------------- |
| `calculation`    | `common.#calculation`         | `last` (required)      |
| `levels`         | 1 to 4 Prometheus label names | `["namespace", "pod"]` |
| `format`         | `common.#format`              | `{ unit: decimal }`    |
| `colorBy`        | `topLevel` \| `thresholds`    | `topLevel`             |
| `thresholds`     | `common.#thresholds`          | Perses default         |
| `topN`           | int ≥ 1                       | unset (no limit)       |
| `showBreadcrumb` | bool                          | `true`                 |

Examples in `schemas/panels/treemap-chart/tests/valid` and `tests/invalid`, checked by
`percli plugin test-schemas`.

## Tests

- `data.test.ts`: levels, `(none)`, summing, sort, `topN` and Other (sum and members), negatives,
  several queries, 2,000 leaves.
- `colours.test.ts`: palette index, alpha and mix, threshold bands in absolute and percent mode.
- `TreemapChartComponent.test.tsx`: empty states (no results; every value null or negative; no
  levels configured), the tree and total, drill-down by click and keyboard, breadcrumb and Up
  button, tooltip text, Other and `(none)`, thresholds legend, 2,000 leaves within time with
  small-box labels hidden, no new chart option on a re-render with the same data. A failed query
  never reaches the panel: Perses' panel wrapper shows the error, as for every panel plugin.
- `TreemapChartSettingsEditor.test.tsx`: every option.

## Dev stack

`dev/docker-compose.yaml`: Perses v0.55.1, Prometheus, and a generator of OpenCost-style metrics
(`dev/fake_metrics.py`). The dashboard `dev/dashboards/cost-treemap.json` shows cost by team →
namespace → workload, every pod as a leaf, and memory with thresholds.

## Open questions

- `levels` is a copy of the Sankey plugin's. It should move to a shared package once a third plugin
  needs it.
- Negative values (credits, refunds) are skipped and counted. A treemap cannot draw them; a
  separate "credits" figure in the header could come later.
- The `perses-plugin-opencost` datasource is being built in parallel. Its series carry the same
  kind of labels, so the panel should need no change; check once it is released.
