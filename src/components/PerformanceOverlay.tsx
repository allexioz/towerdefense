import { usePerformanceStore } from "../state/performanceStore";

function formatWhole(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toString() : "0";
}

function formatFrameMs(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

export function PerformanceOverlay() {
  const stats = usePerformanceStore((state) => state.stats);

  const metrics = [
    { label: "ms", value: formatFrameMs(stats.frameMs), accent: "is-amber" },
    { label: "FPS", value: formatWhole(stats.fps), accent: "is-rose" },
    { label: "calls", value: formatWhole(stats.drawCalls), accent: "is-cyan" },
    { label: "triangles", value: formatWhole(stats.triangles), accent: "is-cyan" },
    { label: "geometries", value: formatWhole(stats.geometries), accent: "is-green" },
    { label: "textures", value: formatWhole(stats.textures), accent: "is-green" }
  ];

  return (
    <aside className="perf-overlay" aria-label="Performance overlay">
      <div className="perf-grid">
        {metrics.map((metric) => (
          <div key={metric.label} className={`perf-cell ${metric.accent}`}>
            <span className="perf-value">{metric.value}</span>
            <span className="perf-label">{metric.label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
