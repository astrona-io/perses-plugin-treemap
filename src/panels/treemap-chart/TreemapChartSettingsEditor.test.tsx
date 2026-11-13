import { fireEvent, screen } from "@testing-library/react";
import { renderWithTheme } from "../../test-utils/render";
import {
  TreemapChartSettingsEditor,
  parseCount,
} from "./TreemapChartSettingsEditor";
import {
  TreemapChartOptions,
  createInitialTreemapChartOptions,
} from "./treemap-chart-types";

function renderEditor(
  value: TreemapChartOptions,
): jest.Mock & { unmount: () => void } {
  const onChange = jest.fn();
  const { unmount } = renderWithTheme(
    <TreemapChartSettingsEditor value={value} onChange={onChange} />,
  );
  return Object.assign(onChange, { unmount });
}

describe("parseCount", () => {
  it("keeps whole numbers from 1 up", () => {
    expect(parseCount("3")).toBe(3);
    expect(parseCount("2.7")).toBe(2);
    expect(parseCount("0")).toBeUndefined();
    expect(parseCount("")).toBeUndefined();
    expect(parseCount("x")).toBeUndefined();
  });
});

describe("TreemapChartSettingsEditor", () => {
  it("starts from the documented defaults", () => {
    expect(createInitialTreemapChartOptions()).toEqual({
      calculation: "last",
      levels: ["namespace", "pod"],
      format: { unit: "decimal" },
      colorBy: "topLevel",
      showBreadcrumb: true,
    });
  });

  it("adds levels up to four", () => {
    const onChange = renderEditor({
      calculation: "last",
      levels: ["a", "b", "c"],
    });
    fireEvent.click(screen.getByRole("button", { name: "Add level" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ levels: ["a", "b", "c", ""] }),
    );
  });

  it("stops at four levels and keeps at least one", () => {
    renderEditor({ calculation: "last", levels: ["a", "b", "c", "d"] });
    expect(screen.getByRole("button", { name: "Add level" })).toBeDisabled();
  });

  it("cannot remove the last level", () => {
    renderEditor({ calculation: "last", levels: ["a"] });
    expect(screen.getByRole("button", { name: "Remove level" })).toBeDisabled();
  });

  it("reorders and flags invalid label names", () => {
    const onChange = renderEditor({
      calculation: "last",
      levels: ["team", "bad-name"],
    });
    expect(screen.getByText("Letters, digits and _ only")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Move down" })[0]!);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ levels: ["bad-name", "team"] }),
    );
  });

  it("sets topN", () => {
    const onChange = renderEditor({ calculation: "last" });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Top N" }), {
      target: { value: "5" },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ topN: 5 }),
    );
  });

  it("clears topN when the field is emptied", () => {
    const onChange = renderEditor({ calculation: "last", topN: 3 });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Top N" }), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ topN: undefined }),
    );
  });

  it("toggles the breadcrumb", () => {
    const onChange = renderEditor({ calculation: "last" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Show breadcrumb" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ showBreadcrumb: false }),
    );
  });

  it("shows the thresholds editor only when colouring by thresholds", () => {
    const view = renderEditor({ calculation: "last", colorBy: "topLevel" });
    expect(screen.queryAllByText("Thresholds")).toHaveLength(0);
    view.unmount();
    renderEditor({ calculation: "last", colorBy: "thresholds" });
    expect(screen.getAllByText("Thresholds").length).toBeGreaterThan(0);
  });
});
