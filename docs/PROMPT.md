You are a senior TypeScript/React (and, where needed, Go/CUE) engineer and Perses contributor. Build the Perses plugin described below in this repository (`perses-plugin-treemap`). Work autonomously: plan, build, test, document. Open a PR when it's done.

---

# Part 1: What to build. Treemap

**Repo:** `astrona-io/perses-plugin-treemap`
**Plugin kind(s):** Panel: `TreemapChart`
**Focus area:** FinOps
**Concept page:** https://claude.ai/artifact/KcToRbDWESkuMgDtPBrBvE#treemap (a private page; the owner can share it with you. Everything you need from it is in this prompt and in `docs/mockup.png`.)

## What it should look like
See `docs/mockup.png` in the repo. If it isn't there, ask for it. It's a concept sketch: match the idea and information density, not the exact pixels.

## Why
Cost and resource breakdowns have hundreds of leaves, which bar charts can't show. A treemap shows the whole picture and the big spenders at once. It pairs with the existing `perses-plugin-sankey`: Sankey shows the flow (cloud → cluster → team), the treemap shows the share.

## Data it reads
- Any query whose labels form a hierarchy, e.g. `sum by (team, namespace, container) (...)`.
- Today: OpenCost cost metrics or memory/CPU by namespace from Prometheus.
- Soon: the `perses-plugin-opencost` datasource (being built in parallel) returns series with the same kind of labels, so no special handling is needed. Just make sure the panel works with any time-series query.
- Each series is reduced to one value with the standard Perses calculation (last, sum, mean…).

## Spec (options → CUE schema)
- `levels`: ordered list of label names, 1–4. **Use exactly the same config shape and label-parsing logic as the Sankey plugin's levels.** Copy it for now and note in `docs/DECISIONS.md` that it should move to a shared package later.
- `calculation`, `format` (currency, bytes, etc.)
- `colorBy`: `topLevel` (default) | `thresholds`
- `topN` per level, with the remainder grouped into "other"
- `showBreadcrumb`: bool (default true)

## Behaviour
- ECharts treemap (consistent with the Sankey plugin).
- Boxes show name and formatted value when they fit; smaller boxes show them on hover only.
- Click a box to drill in. A breadcrumb at the top shows the path and takes you back up.
- Hover shows full path, value, and share of parent and of total.
- Header shows the total for the current level.

## Acceptance criteria
- 2,000 leaves stay responsive.
- "Other" grouping sums correctly and lists its members in the tooltip.
- Series with a missing level label go into an "(none)" group, not dropped.
- Demo dashboard in `dev/` shows cost by team → namespace → workload with fake OpenCost-style data.

## The plugin family this belongs to
This repo is part of the `astrona-io` Perses plugin set. Already built (read them before you start, and match their structure, tooling, CI and README style):
`perses-plugin-oat-results`, `perses-plugin-sankey`, `perses-plugin-statetimeline`, `perses-plugin-honeycomb`, `perses-plugin-geomap`, `perses-plugin-servicegraph`, all under https://github.com/astrona-io.
Use the same Perses version pin as those repos unless there's a newer stable release, then note it in `docs/DECISIONS.md`.

---

# Part 2: How to build it (Perses plugin guide)

You are building a **Perses plugin** in this repository. Perses is the CNCF
dashboard project (https://github.com/perses/perses). Its core plugins live in
https://github.com/perses/plugins.


## Ground rules

1. **Copy upstream conventions; don't invent your own.** Before writing code, clone
   `perses/plugins` next to this repo and read 2–3 plugins close to this one.
   Panels: `timeserieschart`, `statushistorychart`, `heatmapchart`, `table`.
   Datasources: `prometheus`, `tempo`, `victorialogs`.
   Match their folder layout, `package.json` (including the `perses` section),
   the CUE schema layout, and the rsbuild / module-federation config.
2. **Scaffold with percli. Never hand-build the directory structure.** Install
   `percli` from the Perses GitHub releases (or `brew install perses/tap/percli`).
   Then check the real flags with `percli plugin --help` and
   `percli plugin generate --help`. Flags change between releases, so don't
   trust memory or this file over `--help`.
   - `percli plugin generate …` scaffolds the module or plugin
   - `percli plugin start` runs it against a local Perses dev server
   - `percli plugin test-schemas` validates the CUE schemas and JSON examples
   - `percli plugin build` produces the distributable archive
3. **Use the latest stable Perses release.** Pin `@perses-dev/*` package versions
   to the release you develop against. Write that release in the README.
4. **Use the shared building blocks:**
   - `@perses-dev/plugin-system` for plugin types and hooks (`useDataQueries`,
     time range, variables)
   - `@perses-dev/components` for UI pieces, legends, tooltips and the ECharts wrapper
   - `@perses-dev/core` for value formatting, units and thresholds
   - Reuse the shared CUE types (`common.#format`, `common.#thresholds`, …) in schemas
5. **Theme-aware only.** No hard-coded colours. Use the MUI theme and the Perses
   chart theme so light and dark mode both work.
6. **Accessibility.** Status must never be shown by colour alone. Use icon,
   label or pattern too. Everything clickable must be reachable by keyboard.
7. **Performance.** Stay smooth at the "large" size named in Part 1.
   Memoise transforms. Don't re-render on hover.
8. **Licence.** Apache-2.0, same as Perses. Only add dependencies with
   compatible licences. Prefer libraries already used upstream (ECharts, MUI).
9. **Stay upstreamable.** Write it so it could be offered to `perses/plugins`
   later: same code style, lint config, tests and docs format. Before you start,
   search `perses/plugins` issues and PRs for this plugin. If someone is already
   building it, stop and report that.

## Local dev environment

Add a `dev/` folder with a `docker-compose.yaml` that starts:
- Perses (official image)
- the data backend this plugin needs (usually Prometheus)
- a **fake-data generator** that emits the metrics, logs or API responses in
  Part 1, with realistic labels and some failure cases

Also provision a demo dashboard that uses the plugin (`dev/dashboards/*.json`),
so `docker compose up` followed by `percli plugin start` shows it working.

## Definition of done

- [ ] Scaffolded with `percli`. Layout matches upstream plugins.
- [ ] CUE schema plus at least one JSON example. `percli plugin test-schemas` passes.
- [ ] Grafana migration (`migrate/` CUE) if Part 1 names a Grafana equivalent.
- [ ] Panel options editor for every option in the spec, with sensible defaults.
- [ ] Unit tests (Jest + React Testing Library) for data transforms and rendering.
      Cover the empty state, error state and large-data cases.
- [ ] Works in light and dark theme. Includes screenshots of both in `docs/`.
- [ ] `percli plugin build` produces an archive. CI builds it on every PR.
- [ ] A GitHub Actions release workflow attaches the archive to a GitHub release on `v*` tags.
- [ ] README covers what it does, install, the data it expects, the options, a screenshot,
      and the Perses version it was tested with.
- [ ] Every acceptance criterion in Part 1 is checked off in the PR description.

## Working style

- Plan first. Write `docs/PLAN.md` covering the data model, component tree,
  schema and open questions before writing code.
- Use small commits with conventional messages (`feat:`, `fix:`, `docs:`, `test:`).
- If something in Part 1 is unclear or seems wrong, record your decision in
  `docs/DECISIONS.md` and keep going. Don't stop for the sake of it.
