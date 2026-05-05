import { describe, expect, it } from "vitest";
import { createBoardStore, getUnitById } from "../src/state/boardStore";

describe("board store", () => {
  it("starts with exactly three starter units on the bench", () => {
    const store = createBoardStore();
    const state = store.getState();

    expect(state.units).toHaveLength(3);
    expect(state.units.every((unit) => unit.placement.kind === "bench")).toBe(true);
  });

  it("moves a unit onto a valid player tile and rejects enemy tiles", () => {
    const store = createBoardStore();

    expect(store.getState().moveUnitToBoard("ser-caldor", { col: 2, row: 2 })).toBe(false);
    expect(store.getState().moveUnitToBoard("ser-caldor", { col: 2, row: 5 })).toBe(true);

    const unit = getUnitById(store.getState().units, "ser-caldor");
    expect(unit?.placement).toEqual({ kind: "board", coord: { col: 2, row: 5 } });
  });

  it("moves a board unit back to an open bench slot and keeps drag state clean", () => {
    const store = createBoardStore();
    store.getState().moveUnitToBoard("nyra", { col: 5, row: 6 });
    store.getState().beginDrag("nyra");
    expect(store.getState().draggingUnitId).toBe("nyra");

    expect(store.getState().moveUnitToBench("nyra", 2)).toBe(true);
    store.getState().endDrag();

    const unit = getUnitById(store.getState().units, "nyra");
    expect(unit?.placement).toEqual({ kind: "bench", slot: 2 });
    expect(store.getState().draggingUnitId).toBeNull();
  });

  it("resets back to the original sandbox state", () => {
    const store = createBoardStore();
    store.getState().moveUnitToBoard("tovin", { col: 4, row: 7 });
    store.getState().selectUnit("tovin");
    store.getState().resetSandbox();

    const state = store.getState();
    expect(state.selectedUnitId).toBeNull();
    expect(state.draggingUnitId).toBeNull();
    expect(state.units.map((unit) => unit.placement)).toEqual([
      { kind: "bench", slot: 0 },
      { kind: "bench", slot: 1 },
      { kind: "bench", slot: 2 }
    ]);
  });
});
