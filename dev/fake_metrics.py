"""Serves made-up OpenCost-style allocation and price metrics on :8000/metrics.

Only for the dev stack: it gives the dashboards in dashboards/ a cluster's worth of cost data to
draw without a real cluster. Every team, namespace, workload and node name is invented. The shapes
follow OpenCost's exported metrics (container_cpu_allocation, container_memory_allocation_bytes,
node_cpu_hourly_cost, node_ram_hourly_cost) and kube-state-metrics' kube_namespace_labels and
kube_pod_labels, so the dashboard queries are the ones you would write against a real cluster.

The layout is fixed (seeded): 6 teams, 25 namespaces, 120 workloads, 2,000 pods on 12 nodes.
Two namespaces have no team label and a few pods have no app label, so the treemap shows its
"(none)" group. Allocations move a little on every scrape.
"""

import random
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TEAMS = {
    "checkout": ["checkout-api", "checkout-web", "payments", "fraud"],
    "catalog": ["catalog-api", "search", "recommendations", "images"],
    "identity": ["accounts", "auth", "sessions"],
    "data": ["ingest", "warehouse", "reports", "ml-training", "feature-store"],
    "growth": ["campaigns", "email", "experiments"],
    "platform": ["ingress", "observability", "ci-runners", "backups"],
}
# Namespaces nobody labelled with a team.
UNOWNED = ["sandbox", "legacy-batch"]

WORKLOAD_WORDS = [
    "api", "worker", "web", "cron", "consumer", "gateway", "cache", "indexer",
    "exporter", "scheduler", "proxy", "sync", "db", "queue", "renderer",
]

NODES = {
    # name: (instance type, $ per vCPU-hour, $ per GiB-hour)
    **{f"node-general-{i}": ("general-8x32", 0.031, 0.0042) for i in range(1, 7)},
    **{f"node-compute-{i}": ("compute-16x32", 0.027, 0.0040) for i in range(1, 4)},
    **{f"node-memory-{i}": ("memory-8x64", 0.034, 0.0035) for i in range(1, 4)},
}

TOTAL_WORKLOADS = 120
TOTAL_PODS = 2000
GIB = 1024**3


def build_layout():
    """Namespaces, workloads and pods, the same on every start."""
    rng = random.Random(42)
    namespaces = [(team, ns) for team, nss in TEAMS.items() for ns in nss]
    namespaces += [(None, ns) for ns in UNOWNED]
    assert len(namespaces) == 25

    # Spread 120 workloads over 25 namespaces: at least two each, the rest at random.
    per_ns = [2] * len(namespaces)
    for _ in range(TOTAL_WORKLOADS - sum(per_ns)):
        per_ns[rng.randrange(len(namespaces))] += 1

    workloads = []
    for (team, ns), count in zip(namespaces, per_ns):
        words = rng.sample(WORKLOAD_WORDS, count) if count <= len(WORKLOAD_WORDS) else WORKLOAD_WORDS
        for i, word in enumerate(words[:count]):
            name = f"{ns}-{word}" if i < len(words) else f"{ns}-{word}-{i}"
            # Skewed sizes: most workloads are small, a few are big.
            cpu = round(rng.lognormvariate(-1.2, 0.9), 3)  # cores per pod
            mem = rng.lognormvariate(-0.2, 0.8) * GIB  # bytes per pod
            weight = rng.lognormvariate(0, 1.0)
            workloads.append({"team": team, "ns": ns, "name": name, "cpu": cpu, "mem": mem, "weight": weight})

    # 2,000 pods in proportion to each workload's weight, at least one each.
    total_weight = sum(w["weight"] for w in workloads)
    for w in workloads:
        w["replicas"] = max(1, int(w["weight"] / total_weight * (TOTAL_PODS - len(workloads))))
    short = TOTAL_PODS - sum(w["replicas"] for w in workloads)
    for i in range(short):
        workloads[i % len(workloads)]["replicas"] += 1

    nodes = list(NODES)
    pods = []
    for w in workloads:
        for r in range(w["replicas"]):
            suffix = "".join(rng.choice("bcdfghjklmnpqrstvwxz2456789") for _ in range(5))
            pods.append({
                "ns": w["ns"],
                "pod": f"{w['name']}-{suffix}",
                # Batch jobs started by hand carry no app label.
                "app": None if w["ns"] == "legacy-batch" and r % 7 == 0 else w["name"],
                "container": w["name"].split("-")[-1],
                "node": nodes[rng.randrange(len(nodes))],
                "cpu": w["cpu"],
                "mem": w["mem"],
            })
    assert len(pods) == TOTAL_PODS
    return namespaces, pods


NAMESPACES, PODS = build_layout()
rng = random.Random()


def jitter(v: float) -> float:
    return v * rng.uniform(0.95, 1.05)


def render() -> str:
    out = ["# TYPE node_cpu_hourly_cost gauge"]
    for node, (itype, cpu, _) in NODES.items():
        out.append(f'node_cpu_hourly_cost{{node="{node}",instance_type="{itype}"}} {cpu}')
    out.append("# TYPE node_ram_hourly_cost gauge")
    for node, (itype, _, ram) in NODES.items():
        out.append(f'node_ram_hourly_cost{{node="{node}",instance_type="{itype}"}} {ram}')

    out.append("# TYPE kube_namespace_labels gauge")
    for team, ns in NAMESPACES:
        team_label = f',label_team="{team}"' if team else ""
        out.append(f'kube_namespace_labels{{namespace="{ns}"{team_label}}} 1')

    out.append("# TYPE kube_pod_labels gauge")
    for p in PODS:
        app = f',label_app="{p["app"]}"' if p["app"] else ""
        out.append(f'kube_pod_labels{{namespace="{p["ns"]}",pod="{p["pod"]}"{app}}} 1')

    cpu_lines = ["# TYPE container_cpu_allocation gauge"]
    mem_lines = ["# TYPE container_memory_allocation_bytes gauge"]
    for p in PODS:
        labels = f'namespace="{p["ns"]}",pod="{p["pod"]}",container="{p["container"]}",node="{p["node"]}"'
        cpu_lines.append(f"container_cpu_allocation{{{labels}}} {jitter(p['cpu']):.4f}")
        mem_lines.append(f"container_memory_allocation_bytes{{{labels}}} {jitter(p['mem']):.0f}")
    return "\n".join(out + cpu_lines + mem_lines) + "\n"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path != "/metrics":
            self.send_error(404)
            return
        body = render().encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; version=0.0.4")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args: object) -> None:
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("", 8000), Handler).serve_forever()
