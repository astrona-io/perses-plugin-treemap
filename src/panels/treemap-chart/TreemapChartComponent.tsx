import {
  useCallback,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import {
  Box,
  Breadcrumbs,
  Button,
  Link,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import {
  NoDataOverlay,
  TextOverlay,
  formatValue,
  useChartsTheme,
  type FormatOptions,
} from "@perses-dev/components";
import type { EChartsOption } from "echarts";
import {
  DEFAULT_COLOR_BY,
  DEFAULT_LEVELS,
  DEFAULT_SHOW_BREADCRUMB,
  MAX_LEVELS,
  type TreemapChartProps,
} from "./treemap-chart-types";
import {
  EMPTY_LABEL,
  buildTree,
  findNode,
  parentOf,
  type Tree,
  type TreeNode,
} from "./data";
import {
  hashIndex,
  thresholdBand,
  thresholdBands,
  mix,
  withAlpha,
  type ThresholdColours,
} from "./colours";
import { TreemapCanvas } from "./TreemapCanvas";

const DEFAULT_FORMAT: FormatOptions = { unit: "decimal" };
const HEADER_HEIGHT = 32;
const FOOTNOTE_HEIGHT = 18;
const UPPER_LABEL_HEIGHT = 22;
/** Boxes smaller than this (px²) show their name and value on hover only. */
const MIN_LABEL_AREA = 3200;
/** How many members of an "Other" group the tooltip lists. */
const OTHER_TOOLTIP_MEMBERS = 12;
/** Levels drawn below the current node: its children, and theirs inside them. */
const DEPTH = 2;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** ECharts rich text uses `{name|text}`; braces in a label value would break it. */
function richSafe(s: string): string {
  return s.replace(/[{}|]/g, (c) => (c === "|" ? "/" : c === "{" ? "(" : ")"));
}

function percent(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  const p = (part / whole) * 100;
  // A real share too small for one decimal still reads as more than nothing.
  if (p > 0 && p < 0.05) return "<0.1%";
  return `${p >= 10 || p === 0 ? p.toFixed(0) : p.toFixed(1)}%`;
}

interface Datum {
  id: string;
  name: string;
  value: number;
  itemStyle: { color: string; borderColor: string; borderWidth: number };
  label: { show: boolean };
  upperLabel: { show: boolean };
  children?: Datum[];
}

/** One line per level of a node's path, "label: value". */
function pathLines(node: TreeNode, levels: string[]): string[] {
  return node.path.map((name, i) => {
    const level = node.other && i === node.path.length - 1 ? "" : levels[i];
    return level ? `${level}: ${name}` : name;
  });
}

export function TreemapChartComponent(
  props: TreemapChartProps,
): ReactElement | null {
  const { queryResults, spec, contentDimensions } = props;
  const muiTheme = useTheme();
  const chartsTheme = useChartsTheme();

  const calculation = spec.calculation ?? "last";
  const levels = useMemo(
    () =>
      (spec.levels ?? DEFAULT_LEVELS)
        .filter((l) => l.trim() !== "")
        .slice(0, MAX_LEVELS),
    [spec.levels],
  );
  const format = spec.format ?? DEFAULT_FORMAT;
  const colorBy = spec.colorBy ?? DEFAULT_COLOR_BY;
  const thresholds = spec.thresholds;
  const topN = spec.topN;
  const showBreadcrumb = spec.showBreadcrumb ?? DEFAULT_SHOW_BREADCRUMB;

  const tree: Tree = useMemo(
    () => buildTree(queryResults, { calculation, levels, topN }),
    [queryResults, calculation, levels, topN],
  );

  const [requestedPath, setPath] = useState<string[]>([]);
  const { node: current, path } = useMemo(
    () => findNode(tree.root, requestedPath),
    [tree, requestedPath],
  );
  const pathKey = path.join("\u0000");
  // Keyboard focus among the current level's boxes; reset when the level changes.
  const [focus, setFocus] = useState<{ key: string; index: number }>({
    key: "",
    index: -1,
  });
  const focusIndex = focus.key === pathKey ? focus.index : -1;
  const focused = focusIndex >= 0 ? current.children[focusIndex] : undefined;

  const palette = useMemo(() => {
    const themed = chartsTheme.echartsTheme.color;
    if (Array.isArray(themed) && themed.length > 0)
      return themed.filter((c): c is string => typeof c === "string");
    const p = muiTheme.palette;
    return [
      p.primary.main,
      p.secondary.main,
      p.success.main,
      p.warning.main,
      p.info.main,
      p.error.main,
    ];
  }, [chartsTheme, muiTheme]);

  const thresholdTheme: ThresholdColours = useMemo(
    () => ({
      defaultColor: chartsTheme.thresholds.defaultColor,
      palette: chartsTheme.thresholds.palette,
    }),
    [chartsTheme],
  );

  const fmt = useCallback(
    (v: number): string => formatValue(v, format),
    [format],
  );

  // The outermost boxes of the current view take palette colours in name order: stable across
  // refreshes while the set of names stays the same, and no two share a colour until there are
  // more boxes than colours. Everything inside a box shares its colour.
  const topIndex = useMemo(() => {
    const names = current.children
      .map((c) => c.path[path.length] ?? c.name)
      .sort((a, b) => a.localeCompare(b));
    return new Map(names.map((n, i) => [n, i]));
  }, [current, path.length]);

  const colourOf = useCallback(
    (n: TreeNode): string => {
      if (colorBy === "thresholds")
        return thresholdBand(
          n.value,
          tree.root.value,
          thresholds,
          format,
          thresholdTheme,
        ).color;
      const top = n.path[path.length] ?? n.name;
      const i = topIndex.get(top) ?? hashIndex(top, palette.length);
      return palette[i % palette.length] ?? muiTheme.palette.text.primary;
    },
    [
      colorBy,
      tree,
      path.length,
      topIndex,
      thresholds,
      format,
      thresholdTheme,
      palette,
      muiTheme,
    ],
  );

  const width = contentDimensions?.width ?? 0;
  const height = contentDimensions?.height ?? 0;
  const footnote = useMemo(() => {
    const parts: string[] = [];
    if (tree.missingLabel > 0)
      parts.push(
        `${tree.missingLabel} series without a level label grouped under "${EMPTY_LABEL}"`,
      );
    if (tree.negative > 0)
      parts.push(`${tree.negative} negative series not shown`);
    return parts.join(" · ");
  }, [tree]);
  const chartHeight = Math.max(
    0,
    height - HEADER_HEIGHT - (footnote ? FOOTNOTE_HEIGHT : 0),
  );

  const option = useMemo((): EChartsOption => {
    const text = muiTheme.palette.text;
    const background = muiTheme.palette.background.paper;
    const area = width * chartHeight;
    const scale = current.value > 0 ? area / current.value : 0;

    const toDatum = (n: TreeNode, depth: number): Datum => {
      const colour = colourOf(n);
      const isFocused = focused !== undefined && n.id === focused.id;
      const hasChildren = depth < DEPTH && n.children.length > 0;
      const big = n.value * scale >= MIN_LABEL_AREA;
      return {
        id: n.id,
        name: n.name,
        value: n.value,
        itemStyle: {
          // A parent's colour is its frame and title bar; a leaf's is its fill, with a stronger border.
          color: mix(colour, background, hasChildren ? 0.4 : 0.28),
          borderColor: isFocused
            ? text.primary
            : mix(colour, background, hasChildren ? 0.4 : 0.75),
          borderWidth: isFocused ? 3 : 1,
        },
        label: { show: big },
        upperLabel: { show: big },
        ...(hasChildren
          ? { children: n.children.map((c) => toDatum(c, depth + 1)) }
          : {}),
      };
    };

    const tooltip = (n: TreeNode): string => {
      const parent = parentOf(tree, n);
      const lines = pathLines(n, levels).map(escapeHtml);
      const out = [
        `<span style="font-weight:600">${lines.join(" &rsaquo; ")}</span>`,
        `<b>${escapeHtml(fmt(n.value))}</b>`,
      ];
      const shares: string[] = [];
      if (parent && parent !== tree.root)
        shares.push(
          `${percent(n.value, parent.value)} of ${escapeHtml(parent.name)}`,
        );
      shares.push(`${percent(n.value, tree.root.value)} of total`);
      out.push(shares.join(" · "));
      if (colorBy === "thresholds") {
        const band = thresholdBand(
          n.value,
          tree.root.value,
          thresholds,
          format,
          thresholdTheme,
        );
        out.push(`Threshold: ${escapeHtml(band.label)}`);
      }
      if (n.other) {
        const shown = n.other.slice(0, OTHER_TOOLTIP_MEMBERS);
        out.push(
          `<span style="opacity:0.85">${shown
            .map((m) => `${escapeHtml(m.name)}: ${escapeHtml(fmt(m.value))}`)
            .join("<br/>")}${
            n.other.length > shown.length
              ? `<br/>and ${n.other.length - shown.length} more`
              : ""
          }</span>`,
        );
      } else if (n.children.length > 0) {
        out.push(
          `<span style="opacity:0.7">${n.children.length} ${escapeHtml(levels[n.path.length] ?? "")} · click to open</span>`,
        );
      }
      return out.join("<br/>");
    };

    return {
      animation: false,
      tooltip: {
        trigger: "item",
        confine: true,
        formatter: (raw: unknown): string => {
          const id = (raw as { data?: { id?: string } }).data?.id;
          const n = id !== undefined ? tree.byId.get(id) : undefined;
          return n ? tooltip(n) : "";
        },
      },
      series: [
        {
          type: "treemap",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          squareRatio: 0.5 * (1 + Math.sqrt(5)),
          visibleMin: 4,
          itemStyle: { gapWidth: 2, borderWidth: 1, borderRadius: 3 },
          levels: [
            // The root: no frame and no title bar; its total is in the header.
            {
              itemStyle: {
                gapWidth: 4,
                borderWidth: 0,
                color: "transparent",
                borderColor: "transparent",
              },
              upperLabel: { show: false },
            },
            { itemStyle: { gapWidth: 2 } },
            {},
          ],
          upperLabel: {
            show: true,
            height: UPPER_LABEL_HEIGHT,
            color: text.primary,
            fontSize: 12,
            formatter: (p: { name?: string; value?: unknown }) =>
              `{name|${richSafe(p.name ?? "")}}  {value|${richSafe(fmt(Number(p.value ?? 0)))}}`,
            rich: {
              name: { fontWeight: "bold", color: text.primary, fontSize: 12 },
              value: { color: text.secondary, fontSize: 12 },
            },
          },
          label: {
            show: true,
            position: "insideTopLeft",
            color: text.primary,
            overflow: "truncate",
            formatter: (p: { name?: string; value?: unknown }) =>
              `{name|${richSafe(p.name ?? "")}}\n{value|${richSafe(fmt(Number(p.value ?? 0)))}}`,
            rich: {
              name: { color: text.primary, fontSize: 12, lineHeight: 16 },
              value: { color: text.secondary, fontSize: 11, lineHeight: 15 },
            },
          },
          data: current.children.map((c) => toDatum(c, 1)) as never,
        },
      ],
    };
  }, [
    current,
    tree,
    levels,
    width,
    chartHeight,
    colourOf,
    focused,
    fmt,
    colorBy,
    thresholds,
    format,
    thresholdTheme,
    muiTheme,
  ]);

  const drillTo = useCallback((p: string[]) => setPath(p), []);

  const onBoxClick = useCallback(
    (id: string) => {
      const n = tree.byId.get(id);
      if (!n || n.other) return;
      if (n.children.length > 0) {
        drillTo(n.path);
        return;
      }
      // A leaf inside a box opens that box, so the leaf gets bigger.
      const parent = parentOf(tree, n);
      if (parent && parent !== current && parent.children.length > 0)
        drillTo(parent.path);
    },
    [tree, current, drillTo],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const count = current.children.length;
    if (count === 0) return;
    const move = (to: number): void => {
      e.preventDefault();
      setFocus({ key: pathKey, index: ((to % count) + count) % count });
    };
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        move(focusIndex + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        move(focusIndex < 0 ? count - 1 : focusIndex - 1);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(count - 1);
        break;
      case "Enter":
      case " ":
        if (focused && !focused.other && focused.children.length > 0) {
          e.preventDefault();
          drillTo(focused.path);
        }
        break;
      case "Escape":
      case "Backspace":
        if (path.length > 0) {
          e.preventDefault();
          drillTo(path.slice(0, -1));
        }
        break;
    }
  };

  const announcement = focused
    ? `${focused.name}, ${fmt(focused.value)}, ${percent(focused.value, tree.root.value)} of total${
        !focused.other && focused.children.length > 0
          ? ". Press Enter to open"
          : ""
      }`
    : "";

  if (!contentDimensions) return null;

  let empty: ReactElement | null = null;
  if (levels.length === 0)
    empty = <TextOverlay message="Set at least one level" />;
  else if (tree.used === 0 || current.children.length === 0)
    empty = <NoDataOverlay resource="data" />;

  const bands =
    colorBy === "thresholds"
      ? thresholdBands(thresholds, format, thresholdTheme)
      : [];

  return (
    <Box
      sx={{
        position: "relative",
        width: contentDimensions.width,
        height: contentDimensions.height,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ height: HEADER_HEIGHT, px: 0.5, minWidth: 0 }}
      >
        <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          {showBreadcrumb ? (
            <Breadcrumbs
              aria-label="Treemap level"
              maxItems={5}
              sx={{ "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" } }}
            >
              {path.length === 0 ? (
                <Typography variant="body2" color="text.primary" noWrap>
                  All
                </Typography>
              ) : (
                <Link
                  component="button"
                  variant="body2"
                  underline="hover"
                  color="text.secondary"
                  onClick={() => drillTo([])}
                >
                  All
                </Link>
              )}
              {path.map((name, i) =>
                i === path.length - 1 ? (
                  <Typography
                    key={i}
                    variant="body2"
                    color="text.primary"
                    fontWeight={600}
                    noWrap
                    title={`${levels[i]}: ${name}`}
                  >
                    {name}
                  </Typography>
                ) : (
                  <Link
                    key={i}
                    component="button"
                    variant="body2"
                    underline="hover"
                    color="text.secondary"
                    title={`${levels[i]}: ${name}`}
                    onClick={() => drillTo(path.slice(0, i + 1))}
                  >
                    {name}
                  </Link>
                ),
              )}
            </Breadcrumbs>
          ) : path.length > 0 ? (
            <Button size="small" onClick={() => drillTo(path.slice(0, -1))}>
              Up
            </Button>
          ) : null}
        </Box>
        {bands.length > 1 ? (
          <Stack
            direction="row"
            spacing={1}
            aria-label="Threshold legend"
            sx={{ flexShrink: 1, overflow: "hidden" }}
          >
            {bands.map((b) => (
              <Stack
                key={b.index}
                direction="row"
                alignItems="center"
                spacing={0.5}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: 0.5,
                    bgcolor: withAlpha(b.color, 0.5),
                    border: 1,
                    borderColor: b.color,
                  }}
                />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {b.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : null}
        <Typography
          variant="body2"
          color="text.secondary"
          noWrap
          sx={{ flexShrink: 0 }}
          data-testid="treemap-total"
        >
          Total{" "}
          <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>
            {fmt(current.value)}
          </Box>
        </Typography>
      </Stack>
      {/* Focusable, so the boxes can be reached with the keyboard: arrows move, Enter opens, Escape goes up. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <Box
        role="group"
        tabIndex={0}
        aria-label="Treemap. Arrow keys move between boxes, Enter opens one, Escape goes up a level."
        onKeyDown={onKeyDown}
        sx={{
          position: "relative",
          height: chartHeight,
          outline: "none",
          "&:focus-visible": {
            boxShadow: `inset 0 0 0 2px ${muiTheme.palette.primary.main}`,
          },
        }}
      >
        {empty ? (
          <Box sx={{ position: "absolute", inset: 0 }}>{empty}</Box>
        ) : (
          <TreemapCanvas
            option={option}
            theme={chartsTheme.echartsTheme}
            width={width}
            height={chartHeight}
            onBoxClick={onBoxClick}
          />
        )}
      </Box>
      <Box
        aria-live="polite"
        sx={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        {announcement}
      </Box>
      {footnote ? (
        <Typography
          variant="caption"
          noWrap
          title={footnote}
          sx={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: 0,
            color: "text.secondary",
            textAlign: "center",
          }}
        >
          {footnote}
        </Typography>
      ) : null}
    </Box>
  );
}
