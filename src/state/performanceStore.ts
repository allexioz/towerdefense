import { create } from "zustand";
import type { PerformanceStats } from "../types";

const DEFAULT_PERFORMANCE_STATS: PerformanceStats = {
  fps: 0,
  frameMs: 0,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0
};

interface PerformanceState {
  stats: PerformanceStats;
  setStats: (stats: PerformanceStats) => void;
}

export const usePerformanceStore = create<PerformanceState>((set) => ({
  stats: DEFAULT_PERFORMANCE_STATS,
  setStats: (stats) => {
    set({ stats });
  }
}));
