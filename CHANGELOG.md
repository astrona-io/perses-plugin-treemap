# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-13

### Added

- `TreemapChart` panel: series grouped by up to four labels (`levels`, outermost first) into
  nested boxes sized by value, each series reduced with a Perses calculation. Series without a
  level's label go into `(none)` and are counted; negative values are left out and counted.
- Drill down by click or keyboard, with a breadcrumb back up (`showBreadcrumb`, default on; an Up
  button when off), and the total of the current level in the header.
- Tooltip with the path, the value, and the share of the parent and of the total.
- `topN`: the largest N boxes under each parent, the rest summed into `Other (k)`, whose tooltip
  lists its members.
- `colorBy`: `topLevel` (one palette colour per outermost box) or `thresholds` (Perses thresholds;
  percent mode compares the share of the total), with a legend naming each band.
- Options editor for every option, CUE schema with valid and invalid examples, and a `dev/` stack
  with made-up OpenCost-style cost data and screenshots in the README taken from it.

[Unreleased]: https://github.com/astrona-io/perses-plugin-treemap/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/astrona-io/perses-plugin-treemap/releases/tag/v0.1.0
