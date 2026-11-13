# Decisions

Choices made while building the plugin, where the spec ([`PROMPT.md`](PROMPT.md)) left room or
needed a reading.

## `levels` is copied from the Sankey plugin

`levels` has the same shape as `perses-plugin-sankey`'s: an ordered list of Prometheus label names,
outermost first, with the same label-name pattern, the same trimming of label values and the same
`(none)` for a missing or empty label. The code is copied, not shared. **It should move to a shared
package** (schema fragment, parser and the levels editor) once a third plugin needs it; until then
a copy keeps each plugin installable on its own.

One difference: the Sankey plugin drops a series whose label is missing at a level it needs; the
treemap keeps it under `(none)`, as the acceptance criteria ask, and the panel says how many series
went there.

The treemap allows 1 to 4 levels (Sankey needs at least 2 for a link).

## Tooling: Jest and ESLint, not Vitest and oxlint

`percli plugin generate` v0.55.1 scaffolds Vitest and oxlint. The other astrona-io plugins use Jest
(with `@swc/jest`), React Testing Library and ESLint, with the same CI and release workflows. The
spec asks for Jest and to match those repos, so the scaffold was aligned with them.

## Perses 0.55.1

Built and tested against Perses v0.55.1 (`@perses-dev/*` 0.55.1, `percli` v0.55.1,
`github.com/perses/shared/cue` v0.55.1), the latest stable release and the pin of
`perses-plugin-honeycomb` 0.2.x. Older plugins in the family are on 0.54; nothing here needs 0.55
specifically, but it is the only version tested.

## Rendering with the full `echarts` package

Perses' `EChart` component draws with its trimmed `echarts/core` build, which does not register the
treemap series. The panel calls `init` from the full `echarts` package that Perses shares through
module federation, as the Sankey plugin does, so no second copy of ECharts is bundled.

ECharts' own breadcrumb and `nodeClick: zoomToNode` are off. Drill-down is panel state instead, so
the header (breadcrumb, total), keyboard focus and screen-reader announcements follow it, and only
two depths below the open box are handed to ECharts at a time, which keeps 2,000 leaves fast.

## `topN`: one number, applied under every parent at every level

The spec says "`topN` per level". It is read as one integer that applies under each parent, at
every level: with `topN: 8`, each team shows its 8 largest namespaces and each namespace its 8
largest workloads. A list with one number per level would be more flexible but harder to edit, and
one number covers the cost use case. A per-level list can be added later without breaking this one
(accept `int | [...int]`).

The rest are summed into a box named `Other (k)`, whose tooltip lists its members, largest first
(the first 12, then "and N more"). An Other box of a single member is not made: that box simply
stays.

## Thresholds in percent mode compare the share of the total

Perses' percent thresholds are usually a percentage of a max. A treemap has no max, so in percent
mode a box's value is compared as its share of the total of the panel (not of the current drilled
view, so a box keeps its colour when you drill in). Absolute mode compares the value itself, in the
panel's unit. The step logic is the Honeycomb plugin's.

## Negative values are left out

A treemap cannot draw a negative area. Series that reduce to a negative number (a credit, a refund)
are left out of the tree and counted; the panel's footnote says how many. Null and non-finite
values are skipped.

## Opaque colours

Boxes use the palette colour mixed into the panel background (parents 40 %, leaves 28 %, leaf
borders 75 %) instead of the colour with an alpha. ECharts paints a parent's frame under its
children, so alpha tints stack and nested boxes get darker the deeper they are. The mix gives the
same look at every depth in both themes. The root's frame is hidden.

## `topLevel` colours the outermost boxes of the current view

`colorBy: topLevel` gives each outermost box of the view a palette colour, assigned in name order,
and everything inside it shares that colour. "Outermost" is the current view: after drilling into a
team, its namespaces get the colours, otherwise the whole view would be one colour. Name order
(rather than a hash of the name, as Sankey does) guarantees that no two boxes in a view share a
colour while the palette lasts; the order, and so the colours, stay the same across refreshes as
long as the set of names does.

## Not colour alone

Every box carries its name and value when it fits, and the tooltip carries the full path, value,
shares and, in `thresholds` mode, the step's name. The thresholds legend in the header names each
band. Keyboard: the chart is one tab stop; arrow keys, Home and End move between boxes, Enter or
Space opens one, Escape or Backspace goes up, and each move is announced in an `aria-live` region.

## No Grafana migration

The spec names no Grafana equivalent. Grafana has no core treemap panel (only community plugins
with their own option models), so there is no `migrate/` schema.

## No upstream overlap

`perses/plugins` has no treemap panel, and no open issue or pull request for one was found when
this was built (searched "treemap" in issues and PRs). Nothing to stop for.

## Dev stack port

`dev/docker-compose.yaml` publishes Perses on `127.0.0.1:18082` by default (`PERSES_PORT` to move
it), so it can run beside other Perses instances on 8080.
