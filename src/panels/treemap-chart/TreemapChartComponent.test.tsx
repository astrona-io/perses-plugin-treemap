import { act, fireEvent, screen } from "@testing-library/react";
import type { EChartsOption } from "echarts";
import { renderWithTheme } from "../../test-utils/render";
import { large, results, series } from "../../test-utils/fixtures";
import { TreemapChartComponent } from "./TreemapChartComponent";
import type {
  TreemapChartOptions,
  TreemapChartProps,
} from "./treemap-chart-types";

interface CanvasProps {
  option: EChartsOption;
  onBoxClick?: (id: string) => void;
}

const canvas: { last?: CanvasProps; renders: number } = { renders: 0 };

jest.mock("./TreemapCanvas", () => ({
  TreemapCanvas: (props: CanvasProps) => {
    canvas.last = props;
    canvas.renders += 1;
    return <div data-testid="canvas" />;
  },
}));

interface Datum {
  id: string;
  name: string;
  value: number;
  label: { show: boolean };
  children?: Datum[];
}

function data(): Datum[] {
  const s = (canvas.last!.option.series as Array<{ data: Datum[] }>)[0]!;
  return s.data;
}

function tooltip(id: string): string {
  const t = canvas.last!.option.tooltip as {
    formatter: (p: unknown) => string;
  };
  return t.formatter({ data: { id } });
}

function renderPanel(
  queryResults: TreemapChartProps["queryResults"],
  spec: Partial<TreemapChartOptions> = {},
): ReturnType<typeof renderWithTheme> {
  return renderWithTheme(
    <TreemapChartComponent
      spec={{ calculation: "last", levels: ["team", "namespace"], ...spec }}
      queryResults={queryResults}
      contentDimensions={{ width: 900, height: 500 }}
    />,
  );
}

const SAMPLE = results([
  series({ team: "a", namespace: "x" }, 30),
  series({ team: "a", namespace: "y" }, 10),
  series({ team: "b", namespace: "z" }, 60),
]);

beforeEach(() => {
  canvas.last = undefined;
  canvas.renders = 0;
});

describe("TreemapChartComponent", () => {
  it("says there is no data for empty results", () => {
    renderPanel([]);
    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();
  });

  it("says there is no data when every value is null or negative", () => {
    renderPanel(
      results([
        series({ team: "a", namespace: "x" }, null),
        series({ team: "a", namespace: "x" }, -1),
      ]),
    );
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("explains a configuration without levels instead of drawing", () => {
    renderPanel(SAMPLE, { levels: [] });
    expect(screen.getByText("Set at least one level")).toBeInTheDocument();
  });

  it("draws the first level with the second inside it, and the total", () => {
    renderPanel(SAMPLE);
    expect(data().map((d) => [d.name, d.value])).toEqual([
      ["b", 60],
      ["a", 40],
    ]);
    expect(data()[1]!.children!.map((d) => d.name)).toEqual(["x", "y"]);
    expect(screen.getByTestId("treemap-total")).toHaveTextContent("Total 100");
  });

  it("shows the path, value and both shares on hover", () => {
    renderPanel(SAMPLE);
    const x = data()[1]!.children![0]!;
    const html = tooltip(x.id);
    expect(html).toContain("team: a");
    expect(html).toContain("namespace: x");
    expect(html).toContain("<b>30</b>");
    expect(html).toContain("75% of a");
    expect(html).toContain("30% of total");
  });

  it("drills in on click, and the breadcrumb leads back", () => {
    renderPanel(SAMPLE);
    const a = data()[1]!;
    act(() => canvas.last!.onBoxClick!(a.id));
    expect(data().map((d) => d.name)).toEqual(["x", "y"]);
    expect(screen.getByTestId("treemap-total")).toHaveTextContent("Total 40");
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(data().map((d) => d.name)).toEqual(["b", "a"]);
  });

  it("shows an Up button instead of the breadcrumb when it is off", () => {
    renderPanel(SAMPLE, { showBreadcrumb: false });
    expect(screen.queryByLabelText("Treemap level")).not.toBeInTheDocument();
    act(() => canvas.last!.onBoxClick!(data()[0]!.id));
    fireEvent.click(screen.getByRole("button", { name: "Up" }));
    expect(data()).toHaveLength(2);
  });

  it("moves between boxes and opens one with the keyboard", () => {
    renderPanel(SAMPLE);
    const group = screen.getByRole("group");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(screen.getByText(/^b, 60, 60% of total/)).toBeInTheDocument();
    fireEvent.keyDown(group, { key: "ArrowRight" });
    fireEvent.keyDown(group, { key: "Enter" });
    expect(data().map((d) => d.name)).toEqual(["x", "y"]);
    fireEvent.keyDown(group, { key: "Escape" });
    expect(data().map((d) => d.name)).toEqual(["b", "a"]);
  });

  it("groups past topN into Other, summed, with its members in the tooltip", () => {
    renderPanel(
      results([5, 4, 3, 2, 1].map((v, i) => series({ team: `t${i}` }, v))),
      { levels: ["team"], topN: 2 },
    );
    const other = data().find((d) => d.name === "Other (3)")!;
    expect(other.value).toBe(6);
    const html = tooltip(other.id);
    expect(html).toContain("t2: 3");
    expect(html).toContain("t3: 2");
    expect(html).toContain("t4: 1");
  });

  it("keeps a series with a missing label under (none) and says so", () => {
    renderPanel(
      results([
        series({ team: "a", namespace: "x" }, 1),
        series({ namespace: "x" }, 2),
      ]),
    );
    expect(data().map((d) => d.name)).toContain("(none)");
    expect(
      screen.getByText(/1 series without a level label/),
    ).toBeInTheDocument();
  });

  it("colours by thresholds with a legend, so colour is not the only cue", () => {
    renderPanel(SAMPLE, {
      colorBy: "thresholds",
      thresholds: { steps: [{ value: 50, color: "#ff0000", name: "big" }] },
    });
    expect(screen.getByLabelText("Threshold legend")).toHaveTextContent("big");
    expect(tooltip(data()[0]!.id)).toContain("Threshold: big");
  });

  it("formats values with the format option", () => {
    renderPanel(SAMPLE, { format: { unit: "bytes", decimalPlaces: 0 } });
    expect(screen.getByTestId("treemap-total")).toHaveTextContent(
      "Total 100 bytes",
    );
  });

  it("handles 2,000 leaves, hiding labels on boxes too small to hold them", () => {
    const started = Date.now();
    renderPanel(results(large(5, 4, 10, 10)), {
      levels: ["team", "namespace", "workload", "pod"],
    });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(data()).toHaveLength(5);
    // Two levels are drawn at a time.
    expect(data()[0]!.children!.length).toBe(4);
    expect(data()[0]!.children![0]!.children).toBeUndefined();
    const drill = data()[0]!.children![0]!;
    act(() => canvas.last!.onBoxClick!(drill.id));
    act(() => canvas.last!.onBoxClick!(data()[0]!.id));
    const pods = data();
    expect(pods.length).toBe(10);
    expect(screen.getByLabelText("Treemap level")).toHaveTextContent(
      /team-\d.*ns-.*wl-/,
    );
  });

  it("hides labels on small boxes", () => {
    renderPanel(
      results([series({ team: "big" }, 10_000), series({ team: "tiny" }, 1)]),
      { levels: ["team"] },
    );
    expect(data().map((d) => d.label.show)).toEqual([true, false]);
  });

  it("keeps the chart option when the panel re-renders with the same data", () => {
    const spec: TreemapChartOptions = {
      calculation: "last",
      levels: ["team", "namespace"],
    };
    const panel = (
      <TreemapChartComponent
        spec={spec}
        queryResults={SAMPLE}
        contentDimensions={{ width: 900, height: 500 }}
      />
    );
    const view = renderWithTheme(panel);
    const option = canvas.last!.option;
    view.rerender(
      <TreemapChartComponent
        spec={spec}
        queryResults={SAMPLE}
        contentDimensions={{ width: 900, height: 500 }}
      />,
    );
    expect(canvas.last!.option).toBe(option);
  });
});
