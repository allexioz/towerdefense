import { describe, expect, it } from "vitest";
import { createBoardStore, getUnitById } from "../src/state/boardStore";
import { getTilePosition } from "../src/config/layout";

describe("sky defense board store", () => {
  it("starts level 1 in planning with a relic and the fox ready", () => {
    const store = createBoardStore();
    const state = store.getState();

    expect(state.units).toHaveLength(8);
    expect(state.units.every((unit) => unit.placement.kind === "bench")).toBe(true);
    expect(state.wave.phase).toBe("planning");
    expect(state.wave.enemies).toHaveLength(3);
    expect(state.wave.enemies.map((enemy) => enemy.name)).toEqual(["Mischief Fox", "Quick Fox", "Stubborn Fox"]);
    expect(state.wave.enemies[0].hp).toBe(34);
    expect(state.wave.relic.hp).toBe(3);
  });

  it("places heroes on defender tiles and rejects path tiles", () => {
    const store = createBoardStore();

    expect(store.getState().moveUnitToBoard("ser-caldor", { col: 4, row: 5 })).toBe(false);
    expect(store.getState().moveUnitToBoard("ser-caldor", { col: 0, row: 0 })).toBe(false);
    expect(store.getState().moveUnitToBoard("ser-caldor", { col: 2, row: 7 })).toBe(true);

    const unit = getUnitById(store.getState().units, "ser-caldor");
    expect(unit?.placement).toEqual({ kind: "board", coord: { col: 2, row: 7 } });
  });

  it("starts a wave when at least one defender is deployed", () => {
    const store = createBoardStore();

    store.getState().startWave();
    expect(store.getState().wave.phase).toBe("planning");

    store.getState().moveUnitToBoard("tovin", { col: 2, row: 7 });
    store.getState().startWave();

    expect(store.getState().wave.phase).toBe("active");
    expect(store.getState().wave.log[0]).toContain("Wave 1");
  });

  it("defender attacks reduce fox HP when the fox is in range", () => {
    const store = createBoardStore();
    store.getState().moveUnitToBoard("tovin", { col: 2, row: 7 });
    store.getState().startWave();

    store.getState().tickWave(0.1);

    expect(store.getState().wave.enemies[0].hp).toBeLessThan(34);
    expect(store.getState().wave.attackEffects.length).toBeGreaterThan(0);
    expect(getUnitById(store.getState().units, "tovin")?.targetPosition).not.toBeNull();
  });

  it("keeps foxes visually separated from defender footprints", () => {
    const store = createBoardStore();
    const [towerX, , towerZ] = getTilePosition({ col: 3, row: 7 });

    store.setState((state) => ({
      ...state,
      units: state.units.map((unit) =>
        unit.id === "ser-caldor"
          ? { ...unit, placement: { kind: "board", coord: { col: 3, row: 7 } } }
          : unit
      ),
      wave: {
        ...state.wave,
        phase: "active",
        enemies: state.wave.enemies.map((enemy, index) =>
          index === 0 ? { ...enemy, pathProgress: 2.9, spawnDelay: 0 } : enemy
        )
      }
    }));

    store.getState().tickWave(0.1);

    const fox = store.getState().wave.enemies[0];
    expect(Math.hypot(fox.position[0] - towerX, fox.position[1] - towerZ)).toBeGreaterThanOrEqual(0.85);
  });

  it("wins the wave when defenders repel the fox", () => {
    const store = createBoardStore();
    store.getState().moveUnitToBoard("ser-caldor", { col: 2, row: 7 });
    store.getState().moveUnitToBoard("tovin", { col: 4, row: 7 });
    store.getState().moveUnitToBoard("nyra", { col: 0, row: 4 });
    store.getState().moveUnitToBoard("aurelia", { col: 6, row: 3 });
    store.getState().startWave();

    for (let index = 0; index < 240 && store.getState().wave.phase === "active"; index += 1) {
      store.getState().tickWave(0.1);
    }

    expect(store.getState().wave.phase).toBe("won");
    expect(store.getState().wave.enemies.every((enemy) => enemy.alive === false)).toBe(true);
  });

  it("loses when the relic has no ward seals left", () => {
    const store = createBoardStore();
    store.setState((state) => ({
      ...state,
      units: [],
      wave: {
        ...state.wave,
        phase: "active",
        relic: { ...state.wave.relic, hp: 1 }
      }
    }));

    for (let index = 0; index < 260 && store.getState().wave.phase === "active"; index += 1) {
      store.getState().tickWave(0.1);
    }

    expect(store.getState().wave.phase).toBe("lost");
    expect(store.getState().wave.relic.hp).toBe(0);
  });

  it("resets heroes, relic, fox, and phase", () => {
    const store = createBoardStore();
    store.getState().moveUnitToBoard("kael", { col: 1, row: 7 });
    store.getState().selectUnit("kael");
    store.getState().startWave();
    store.getState().tickWave(0.2);
    store.getState().resetSandbox();

    const state = store.getState();
    expect(state.selectedUnitId).toBeNull();
    expect(state.draggingUnitId).toBeNull();
    expect(state.wave.phase).toBe("planning");
    expect(state.wave.enemies[0].hp).toBe(state.wave.enemies[0].maxHp);
    expect(state.wave.enemies.every((enemy) => enemy.pathProgress === 0)).toBe(true);
    expect(state.wave.relic.hp).toBe(state.wave.relic.maxHp);
    expect(state.units.map((unit) => unit.placement)).toEqual([
      { kind: "bench", slot: 0 },
      { kind: "bench", slot: 1 },
      { kind: "bench", slot: 2 },
      { kind: "bench", slot: 3 },
      { kind: "bench", slot: 4 },
      { kind: "bench", slot: 5 },
      { kind: "bench", slot: 6 },
      { kind: "bench", slot: 7 }
    ]);
  });
});
