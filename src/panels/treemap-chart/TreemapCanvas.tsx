import { useEffect, useRef, type ReactElement } from "react";
import { init, type ECharts, type EChartsOption } from "echarts";

interface TreemapCanvasProps {
  option: EChartsOption;
  theme: string | object;
  width: number;
  height: number;
  /** Called with the `id` of the clicked box. */
  onBoxClick?: (id: string) => void;
}

/**
 * Renders with the shared `echarts` module itself rather than Perses' `EChart` component, as the
 * Sankey plugin does.
 *
 * `EChart` (in @perses-dev/components) draws with the host's trimmed `echarts/core` build, which
 * does not register the `treemap` series. The full `echarts` package that Perses shares through
 * module federation has every series type, so `init` from it can draw a treemap without adding a
 * second copy of ECharts to the bundle.
 */
export function TreemapCanvas(props: TreemapCanvasProps): ReactElement {
  const { option, theme, width, height, onBoxClick } = props;
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  // The latest handler, so a new callback does not re-create the chart.
  const onClick = useRef(onBoxClick);
  onClick.current = onBoxClick;

  // (Re)create the chart when the theme changes (light/dark switch).
  useEffect(() => {
    if (!ref.current) return;
    const instance = init(ref.current, theme as never);
    instance.on("click", (params) => {
      const id = (params.data as { id?: string } | undefined)?.id;
      if (typeof id === "string") onClick.current?.(id);
    });
    chart.current = instance;
    return () => {
      instance.dispose();
      chart.current = null;
    };
  }, [theme]);

  useEffect(() => {
    // notMerge rebuilds the tooltip component; one still showing is then re-shown into
    // its removed element and throws, so hide it first.
    chart.current?.dispatchAction({ type: "hideTip" });
    chart.current?.setOption(option, { notMerge: true });
  }, [option, theme]);

  useEffect(() => {
    chart.current?.resize({ width, height });
  }, [width, height, theme]);

  return <div ref={ref} style={{ width, height }} />;
}
