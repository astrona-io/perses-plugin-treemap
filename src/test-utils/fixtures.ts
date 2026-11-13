import type { PanelData } from "@perses-dev/plugin-system";
import type { TimeSeries, TimeSeriesData } from "@perses-dev/spec";

const T0 = 1_760_000_000_000;

/** One series with a single sample, or several samples one minute apart. */
export function series(
  labels: Record<string, string>,
  value: number | null | Array<number | null>,
): TimeSeries {
  const values = Array.isArray(value) ? value : [value];
  return {
    name: JSON.stringify(labels),
    labels,
    values: values.map((v, i) => [T0 + i * 60_000, v]),
  } as TimeSeries;
}

/** Wraps series as the query results a panel receives. */
export function results(
  ...groups: TimeSeries[][]
): Array<PanelData<TimeSeriesData>> {
  return groups.map((s) => ({
    definition: {
      kind: "TimeSeriesQuery",
      spec: { plugin: { kind: "PrometheusTimeSeriesQuery", spec: {} } },
    },
    data: { series: s, timeRange: { start: new Date(T0), end: new Date(T0) } },
  })) as unknown as Array<PanelData<TimeSeriesData>>;
}

/** `teams` × `namespaces` × `workloads` × `pods` leaves, value 1 each unless given. */
export function large(
  teams: number,
  namespaces: number,
  workloads: number,
  pods: number,
): TimeSeries[] {
  const out: TimeSeries[] = [];
  for (let t = 0; t < teams; t++)
    for (let n = 0; n < namespaces; n++)
      for (let w = 0; w < workloads; w++)
        for (let p = 0; p < pods; p++)
          out.push(
            series(
              {
                team: `team-${t}`,
                namespace: `ns-${t}-${n}`,
                workload: `wl-${t}-${n}-${w}`,
                pod: `pod-${t}-${n}-${w}-${p}`,
              },
              1 + ((t * 7 + n * 5 + w * 3 + p) % 11),
            ),
          );
  return out;
}
