import {
  getCalculation,
  type CalculationType,
  type PanelData,
} from "@perses-dev/plugin-system";
import type { TimeSeriesData } from "@perses-dev/spec";

/**
 * Shown for a level label that is missing or empty. Same as the Sankey plugin, except that a
 * treemap keeps such series (in this group) instead of dropping them.
 */
export const EMPTY_LABEL = "(none)";
/** Name of the box that sums the children past `topN`. */
export const OTHER_LABEL = "Other";

export interface OtherMember {
  name: string;
  value: number;
}

export interface TreeNode {
  /** Unique within the tree: the path joined, with a marker for an "Other" group. */
  id: string;
  /** Label value as displayed. */
  name: string;
  /** Names from the first level down to this node; empty for the root. */
  path: string[];
  value: number;
  /** Largest first; empty for a leaf and for an "Other" group. */
  children: TreeNode[];
  /** Set on an "Other" group: the boxes it stands for, largest first. */
  other?: OtherMember[];
}

export interface Tree {
  root: TreeNode;
  /** Series that went into the tree. */
  used: number;
  /** Series reduced to a negative value: a treemap cannot draw them. */
  negative: number;
  /** Series that went into a "(none)" group on at least one level. */
  missingLabel: number;
  /** Every node by id, for tooltips and clicks. */
  byId: Map<string, TreeNode>;
}

export interface BuildOptions {
  calculation: CalculationType;
  levels: string[];
  topN?: number;
}

const SEP = "\u0000";

/**
 * The label values of one series along the levels. The same parsing as the Sankey plugin's levels:
 * trimmed, and an empty or missing label becomes {@link EMPTY_LABEL}.
 */
export function levelValues(
  labels: Record<string, string> | undefined,
  levels: string[],
): string[] {
  const l = labels ?? {};
  return levels.map((name) => l[name]?.trim() || EMPTY_LABEL);
}

interface Building {
  value: number;
  children: Map<string, Building>;
}

function finish(
  b: Building,
  name: string,
  path: string[],
  topN: number | undefined,
): TreeNode {
  const children = [...b.children.entries()]
    .map(([n, c]) => finish(c, n, [...path, n], topN))
    .sort((x, y) => y.value - x.value || x.name.localeCompare(y.name));
  const node: TreeNode = {
    id: path.join(SEP),
    name,
    path,
    value: b.value,
    children,
  };
  // Grouping a single box would only hide its name, so Other needs at least two members.
  if (topN !== undefined && topN > 0 && children.length > topN + 1) {
    const rest = children.slice(topN);
    node.children = children.slice(0, topN);
    node.children.push({
      id: `${node.id}${SEP}${SEP}other`,
      name: `${OTHER_LABEL} (${rest.length})`,
      path: [...path, OTHER_LABEL],
      value: rest.reduce((s, c) => s + c.value, 0),
      children: [],
      other: rest.map((c) => ({ name: c.name, value: c.value })),
    });
  }
  return node;
}

function index(node: TreeNode, into: Map<string, TreeNode>): void {
  into.set(node.id, node);
  node.children.forEach((c) => index(c, into));
}

/**
 * Reduces every series to one value and adds it to the path of its level labels. Series that share
 * a path are summed. A parent's value is the sum of its children, including those in "Other".
 */
export function buildTree(
  queryResults: Array<PanelData<TimeSeriesData>>,
  opts: BuildOptions,
): Tree {
  const top: Building = { value: 0, children: new Map() };
  let used = 0;
  let negative = 0;
  let missingLabel = 0;

  for (const result of queryResults) {
    for (const series of result.data?.series ?? []) {
      const value = getCalculation(series.values, opts.calculation);
      if (value === null || value === undefined || !Number.isFinite(value))
        continue;
      if (value < 0) {
        negative += 1;
        continue;
      }
      const names = levelValues(series.labels, opts.levels);
      if (names.includes(EMPTY_LABEL)) missingLabel += 1;
      used += 1;
      top.value += value;
      let at = top;
      for (const n of names) {
        let next = at.children.get(n);
        if (!next) {
          next = { value: 0, children: new Map() };
          at.children.set(n, next);
        }
        next.value += value;
        at = next;
      }
    }
  }

  const root = finish(top, "", [], opts.topN);
  const byId = new Map<string, TreeNode>();
  index(root, byId);
  return { root, used, negative, missingLabel, byId };
}

/**
 * The node at `path`, or the deepest one that still exists when the data changed under a
 * drill-down. Returns the node and the path that was actually found.
 */
export function findNode(
  root: TreeNode,
  path: string[],
): { node: TreeNode; path: string[] } {
  let node = root;
  const found: string[] = [];
  for (const name of path) {
    const next = node.children.find((c) => c.name === name && !c.other);
    if (!next || next.children.length === 0) break;
    node = next;
    found.push(name);
  }
  return { node, path: found };
}

/** The parent of a node, found through its path. */
export function parentOf(tree: Tree, node: TreeNode): TreeNode | undefined {
  if (node.path.length === 0) return undefined;
  if (node.other) {
    const id = node.id.slice(0, node.id.length - `${SEP}${SEP}other`.length);
    return tree.byId.get(id);
  }
  return tree.byId.get(node.path.slice(0, -1).join(SEP));
}
