import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { coordsEqual, isPlayerCoord, BOARD_LAYOUT } from "../config/layout";
import type { BoardCoord, BoardStore, SandboxUnit, UnitId, UnitPlacement } from "../types";

const STARTER_UNITS: SandboxUnit[] = [
  {
    id: "ser-caldor",
    name: "Ser Caldor",
    faction: "Sun Court",
    color: "#f1c96b",
    accent: "#ffe6a8",
    placement: { kind: "bench", slot: 0 }
  },
  {
    id: "tovin",
    name: "Tovin",
    faction: "Azure Armada",
    color: "#64b4ff",
    accent: "#b7e3ff",
    placement: { kind: "bench", slot: 1 }
  },
  {
    id: "nyra",
    name: "Nyra",
    faction: "Astral Cloister",
    color: "#ba88ff",
    accent: "#ead5ff",
    placement: { kind: "bench", slot: 2 }
  }
];

function cloneUnits(): SandboxUnit[] {
  return STARTER_UNITS.map((unit) => ({
    ...unit,
    placement: unit.placement.kind === "bench" ? { ...unit.placement } : { kind: "board", coord: { ...unit.placement.coord } }
  }));
}

export function createInitialBoardState() {
  return {
    units: cloneUnits(),
    selectedUnitId: null,
    draggingUnitId: null
  };
}

export function getUnitById(units: SandboxUnit[], id: UnitId): SandboxUnit | undefined {
  return units.find((unit) => unit.id === id);
}

export function getBoardOccupant(units: SandboxUnit[], coord: BoardCoord, ignoreId?: UnitId): SandboxUnit | undefined {
  return units.find(
    (unit) =>
      unit.id !== ignoreId &&
      unit.placement.kind === "board" &&
      coordsEqual(unit.placement.coord, coord)
  );
}

export function getBenchOccupant(units: SandboxUnit[], slot: number, ignoreId?: UnitId): SandboxUnit | undefined {
  return units.find(
    (unit) =>
      unit.id !== ignoreId &&
      unit.placement.kind === "bench" &&
      unit.placement.slot === slot
  );
}

export function findFirstOpenBenchSlot(units: SandboxUnit[], ignoreId?: UnitId): number | null {
  for (let slot = 0; slot < BOARD_LAYOUT.benchSlots; slot += 1) {
    if (!getBenchOccupant(units, slot, ignoreId)) {
      return slot;
    }
  }
  return null;
}

function patchPlacement(units: SandboxUnit[], id: UnitId, placement: UnitPlacement): SandboxUnit[] {
  return units.map((unit) => (unit.id === id ? { ...unit, placement } : unit));
}

export function createBoardStore() {
  return createStore<BoardStore>((set, get) => ({
    ...createInitialBoardState(),
    selectUnit: (id) => {
      set({ selectedUnitId: id });
    },
    beginDrag: (id) => {
      set({ draggingUnitId: id, selectedUnitId: id });
    },
    endDrag: () => {
      set({ draggingUnitId: null });
    },
    moveUnitToBoard: (id, coord) => {
      if (!isPlayerCoord(coord) || getBoardOccupant(get().units, coord, id)) {
        return false;
      }

      set((state) => ({
        units: patchPlacement(state.units, id, { kind: "board", coord }),
        selectedUnitId: id
      }));

      return true;
    },
    moveUnitToBench: (id, benchIndex) => {
      const targetSlot = benchIndex ?? findFirstOpenBenchSlot(get().units, id);
      if (targetSlot === null || targetSlot < 0 || targetSlot >= BOARD_LAYOUT.benchSlots) {
        return false;
      }

      if (getBenchOccupant(get().units, targetSlot, id)) {
        return false;
      }

      set((state) => ({
        units: patchPlacement(state.units, id, { kind: "bench", slot: targetSlot }),
        selectedUnitId: id
      }));

      return true;
    },
    resetSandbox: () => {
      set(createInitialBoardState());
    }
  }));
}

export const boardStore = createBoardStore();

export function useBoardStore<T>(selector: (store: BoardStore) => T): T {
  return useStore(boardStore, selector);
}
