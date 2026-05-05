export type UnitId = "ser-caldor" | "tovin" | "nyra";

export type FactionId = "Sun Court" | "Azure Armada" | "Astral Cloister";

export interface BoardCoord {
  col: number;
  row: number;
}

export interface BenchPlacement {
  kind: "bench";
  slot: number;
}

export interface BoardPlacement {
  kind: "board";
  coord: BoardCoord;
}

export type UnitPlacement = BenchPlacement | BoardPlacement;

export interface SandboxUnit {
  id: UnitId;
  name: string;
  faction: FactionId;
  color: string;
  accent: string;
  placement: UnitPlacement;
}

export interface BoardState {
  units: SandboxUnit[];
  selectedUnitId: UnitId | null;
  draggingUnitId: UnitId | null;
}

export interface BoardActions {
  selectUnit: (id: UnitId | null) => void;
  beginDrag: (id: UnitId) => void;
  endDrag: () => void;
  moveUnitToBoard: (id: UnitId, coord: BoardCoord) => boolean;
  moveUnitToBench: (id: UnitId, benchIndex?: number) => boolean;
  resetSandbox: () => void;
}

export interface BoardLayoutConfig {
  cols: number;
  rows: number;
  playerRowsStart: number;
  tileSize: number;
  tileGap: number;
  benchSlots: number;
  benchSlotSize: number;
  benchSlotGap: number;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  cameraMinDistance: number;
  cameraMaxDistance: number;
  cameraMinPolarAngle: number;
  cameraMaxPolarAngle: number;
  cameraMinAzimuthAngle: number;
  cameraMaxAzimuthAngle: number;
}

export interface PerformanceStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export type BoardStore = BoardState & BoardActions;
