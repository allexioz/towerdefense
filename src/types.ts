export type UnitId =
  | "ser-caldor"
  | "tovin"
  | "nyra"
  | "aurelia"
  | "solene"
  | "scribe-orin"
  | "maelis"
  | "kael";

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

export interface UnitStats {
  damage: number;
  range: number;
  attackSpeed: number;
}

export interface SandboxUnit {
  id: UnitId;
  name: string;
  faction: FactionId;
  color: string;
  accent: string;
  stats: UnitStats;
  placement: UnitPlacement;
  cooldown: number;
  targetPosition: [number, number] | null;
}

export interface WaveEnemy {
  id: string;
  name: string;
  color: string;
  accent: string;
  hp: number;
  maxHp: number;
  speed: number;
  spawnDelay: number;
  pathProgress: number;
  position: [number, number];
  alive: boolean;
  reachedRelic: boolean;
}

export interface RelicState {
  hp: number;
  maxHp: number;
  position: [number, number];
}

export interface AttackEffect {
  id: number;
  unitId: UnitId;
  enemyId: string;
  from: [number, number];
  to: [number, number];
  age: number;
}

export interface WaveState {
  round: number;
  phase: "planning" | "active" | "won" | "lost";
  enemies: WaveEnemy[];
  relic: RelicState;
  attackEffects: AttackEffect[];
  nextAttackEffectId: number;
  log: string[];
}

export interface BoardState {
  units: SandboxUnit[];
  selectedUnitId: UnitId | null;
  draggingUnitId: UnitId | null;
  wave: WaveState;
}

export interface BoardActions {
  selectUnit: (id: UnitId | null) => void;
  beginDrag: (id: UnitId) => void;
  endDrag: () => void;
  moveUnitToBoard: (id: UnitId, coord: BoardCoord) => boolean;
  moveUnitToBench: (id: UnitId, benchIndex?: number) => boolean;
  startWave: () => void;
  tickWave: (deltaSeconds: number) => void;
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
