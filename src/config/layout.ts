import type { BoardCoord, BoardLayoutConfig } from "../types";

export const BOARD_LAYOUT: BoardLayoutConfig = {
  cols: 7,
  rows: 8,
  playerRowsStart: 4,
  tileSize: 1,
  tileGap: 0.12,
  benchSlots: 3,
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

export function getTilePosition(coord: BoardCoord): [number, number, number] {
  const x = (coord.col - (BOARD_LAYOUT.cols - 1) / 2) * TILE_PITCH;
  const z = (coord.row - (BOARD_LAYOUT.rows - 1) / 2) * TILE_PITCH;
  return [x, 0, z];
}

export function isPlayerCoord(coord: BoardCoord): boolean {
  return coord.row >= BOARD_LAYOUT.playerRowsStart && coord.row < BOARD_LAYOUT.rows;
}

export function coordsEqual(a: BoardCoord, b: BoardCoord): boolean {
  return a.col === b.col && a.row === b.row;
}
