import type { BoardCoord, BoardLayoutConfig } from "../types";

export const BOARD_LAYOUT: BoardLayoutConfig = {
  cols: 7,
  rows: 8,
  playerRowsStart: 4,
  tileSize: 1,
  tileGap: 0.12,
  benchSlots: 8,
  benchSlotSize: 110,
  benchSlotGap: 20,
  cameraPosition: [0, 12.9, 13.2],
  cameraTarget: [0, -0.2, 0.35],
  cameraMinDistance: 5.9,
  cameraMaxDistance: 28,
  cameraMinPolarAngle: 0.38,
  cameraMaxPolarAngle: 1.5,
  cameraMinAzimuthAngle: -Infinity,
  cameraMaxAzimuthAngle: Infinity
};

export const TILE_PITCH = BOARD_LAYOUT.tileSize + BOARD_LAYOUT.tileGap;
export const BOARD_WIDTH = (BOARD_LAYOUT.cols - 1) * TILE_PITCH;
export const BOARD_DEPTH = (BOARD_LAYOUT.rows - 1) * TILE_PITCH;
export const LEVEL1_PATH_COORDS: BoardCoord[] = [
  { col: 3, row: 7 },
  { col: 3, row: 6 },
  { col: 2, row: 6 },
  { col: 2, row: 5 },
  { col: 4, row: 5 },
  { col: 4, row: 4 },
  { col: 1, row: 4 },
  { col: 1, row: 3 },
  { col: 5, row: 3 },
  { col: 5, row: 2 },
  { col: 3, row: 2 },
  { col: 3, row: 1 }
];
export const ELEVATED_BUILD_COORDS: BoardCoord[] = [
  { col: 1, row: 7 },
  { col: 2, row: 7 },
  { col: 4, row: 7 },
  { col: 5, row: 7 },
  { col: 1, row: 6 },
  { col: 5, row: 6 },
  { col: 0, row: 5 },
  { col: 3, row: 5 },
  { col: 5, row: 5 },
  { col: 0, row: 4 },
  { col: 3, row: 4 },
  { col: 6, row: 4 },
  { col: 0, row: 3 },
  { col: 3, row: 3 },
  { col: 6, row: 3 },
  { col: 2, row: 2 },
  { col: 4, row: 2 },
  { col: 2, row: 1 },
  { col: 4, row: 1 }
];
export const FOX_PATH_POINTS: Array<[number, number]> = [
  [0, BOARD_DEPTH / 2 + 2.95],
  ...LEVEL1_PATH_COORDS.map((coord) => {
    const [x, , z] = getTilePosition(coord);
    return [x, z] as [number, number];
  }),
  [0, -BOARD_DEPTH / 2 - 1.95]
];
export const RELIC_POSITION: [number, number] = [0, -BOARD_DEPTH / 2 - 1.95];

export function getTilePosition(coord: BoardCoord): [number, number, number] {
  const x = (coord.col - (BOARD_LAYOUT.cols - 1) / 2) * TILE_PITCH;
  const z = (coord.row - (BOARD_LAYOUT.rows - 1) / 2) * TILE_PITCH;
  return [x, 0, z];
}

export function isPlayerCoord(coord: BoardCoord): boolean {
  return coord.row >= BOARD_LAYOUT.playerRowsStart && coord.row < BOARD_LAYOUT.rows;
}

export function isDefenderCoord(coord: BoardCoord): boolean {
  if (coord.col < 0 || coord.col >= BOARD_LAYOUT.cols || coord.row < 0 || coord.row >= BOARD_LAYOUT.rows) {
    return false;
  }

  return ELEVATED_BUILD_COORDS.some((buildCoord) => coordsEqual(buildCoord, coord));
}

export function coordsEqual(a: BoardCoord, b: BoardCoord): boolean {
  return a.col === b.col && a.row === b.row;
}
