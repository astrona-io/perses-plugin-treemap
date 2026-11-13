import { large, results, series } from "../../test-utils/fixtures";
import {
  EMPTY_LABEL,
  buildTree,
  findNode,
  levelValues,
  parentOf,
} from "./data";

const levels = ["team", "namespace"];

describe("levelValues", () => {
  it("trims label values and maps missing or empty ones to (none)", () => {
    expect(
      levelValues({ team: " a ", namespace: "" }, ["team", "namespace", "pod"]),
    ).toEqual(["a", EMPTY_LABEL, EMPTY_LABEL]);
    expect(levelValues(undefined, ["team"])).toEqual([EMPTY_LABEL]);
  });
});

describe("buildTree", () => {
  it("returns an empty root for no data", () => {
    const tree = buildTree([], { calculation: "last", levels });
    expect(tree.used).toBe(0);
    expect(tree.root.value).toBe(0);
    expect(tree.root.children).toEqual([]);
  });

  it("sums series along their path, largest first", () => {
    const tree = buildTree(
      results([
        series({ team: "a", namespace: "x" }, 2),
        series({ team: "a", namespace: "x" }, 3),
        series({ team: "a", namespace: "y" }, 1),
        series({ team: "b", namespace: "z" }, 10),
      ]),
      { calculation: "last", levels },
    );
    expect(tree.root.value).toBe(16);
    expect(tree.root.children.map((c) => [c.name, c.value])).toEqual([
      ["b", 10],
      ["a", 6],
    ]);
    const a = tree.root.children[1]!;
    expect(a.children.map((c) => [c.name, c.value])).toEqual([
      ["x", 5],
      ["y", 1],
    ]);
    expect(a.children[0]!.path).toEqual(["a", "x"]);
  });

  it("reduces each series with the calculation", () => {
    const tree = buildTree(
      results([series({ team: "a", namespace: "x" }, [1, 2, 6])]),
      { calculation: "mean", levels },
    );
    expect(tree.root.value).toBe(3);
  });

  it("keeps series with a missing level label under (none)", () => {
    const tree = buildTree(
      results([
        series({ team: "a", namespace: "x" }, 1),
        series({ namespace: "x" }, 4),
        series({ team: "a" }, 2),
      ]),
      { calculation: "last", levels },
    );
    expect(tree.used).toBe(3);
    expect(tree.missingLabel).toBe(2);
    expect(tree.root.value).toBe(7);
    const none = tree.root.children.find((c) => c.name === EMPTY_LABEL)!;
    expect(none.value).toBe(4);
    const a = tree.root.children.find((c) => c.name === "a")!;
    expect(a.children.map((c) => c.name)).toEqual([EMPTY_LABEL, "x"]);
  });

  it("skips null values and counts negative ones apart", () => {
    const tree = buildTree(
      results([
        series({ team: "a", namespace: "x" }, null),
        series({ team: "a", namespace: "x" }, -3),
        series({ team: "a", namespace: "y" }, 2),
      ]),
      { calculation: "last", levels },
    );
    expect(tree.used).toBe(1);
    expect(tree.negative).toBe(1);
    expect(tree.root.value).toBe(2);
  });

  it("groups children past topN into Other, which sums them and lists its members", () => {
    const tree = buildTree(
      results(
        [5, 4, 3, 2, 1].map((v, i) =>
          series({ team: "a", namespace: `n${i}` }, v),
        ),
      ),
      { calculation: "last", levels, topN: 2 },
    );
    const a = tree.root.children[0]!;
    expect(a.value).toBe(15);
    expect(a.children.map((c) => c.name)).toEqual(["n0", "n1", "Other (3)"]);
    const other = a.children[2]!;
    expect(other.value).toBe(6);
    expect(other.other).toEqual([
      { name: "n2", value: 3 },
      { name: "n3", value: 2 },
      { name: "n4", value: 1 },
    ]);
    expect(a.children.reduce((s, c) => s + c.value, 0)).toBe(a.value);
    expect(parentOf(tree, other)).toBe(a);
    expect(tree.byId.get(other.id)).toBe(other);
  });

  it("applies topN at every level and leaves short lists alone", () => {
    const tree = buildTree(
      results([
        series({ team: "a", namespace: "x" }, 1),
        series({ team: "b", namespace: "x" }, 1),
        series({ team: "c", namespace: "x" }, 1),
      ]),
      { calculation: "last", levels, topN: 3 },
    );
    expect(tree.root.children.some((c) => c.other)).toBe(false);
  });

  it("builds 2,000 leaves quickly and adds them up", () => {
    const leaves = large(5, 4, 10, 10);
    expect(leaves).toHaveLength(2000);
    const want = leaves.reduce((s, x) => s + (x.values[0]![1] as number), 0);
    const started = Date.now();
    const tree = buildTree(results(leaves), {
      calculation: "last",
      levels: ["team", "namespace", "workload", "pod"],
    });
    expect(Date.now() - started).toBeLessThan(500);
    expect(tree.used).toBe(2000);
    expect(tree.root.value).toBe(want);
    expect(tree.byId.size).toBe(1 + 5 + 20 + 200 + 2000);
  });
});

describe("findNode", () => {
  const tree = buildTree(
    results([
      series({ team: "a", namespace: "x" }, 1),
      series({ team: "b", namespace: "y" }, 2),
    ]),
    { calculation: "last", levels },
  );

  it("finds a node by path", () => {
    expect(findNode(tree.root, ["a"]).node.name).toBe("a");
  });

  it("stops at the deepest node that exists and has children", () => {
    expect(findNode(tree.root, ["a", "x"]).path).toEqual(["a"]);
    expect(findNode(tree.root, ["gone", "x"]).path).toEqual([]);
  });
});
