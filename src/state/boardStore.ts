import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { coordsEqual, isDefenderCoord, BOARD_LAYOUT, FOX_PATH_POINTS, RELIC_POSITION } from "../config/layout";
import type { BoardCoord, BoardStore, SandboxUnit, UnitId, UnitPlacement, WaveEnemy } from "../types";

const RELIC_MAX_HP = 3;
const ATTACK_EFFECT_LIFETIME = 0.28;
const DEFENDER_COLLISION_RADIUS = 0.86;
const DEFENDER_COLLISION_ITERATIONS = 3;
const FOX_PACK = [
  { id: "mischief-fox-1", name: "Mischief Fox", hp: 34, speed: 2.02, spawnDelay: 0 },
  { id: "mischief-fox-2", name: "Quick Fox", hp: 24, speed: 2.28, spawnDelay: 2.2 },
  { id: "mischief-fox-3", name: "Stubborn Fox", hp: 42, speed: 1.82, spawnDelay: 4.4 }
] as const;

const STARTER_UNITS: SandboxUnit[] = [
  {
    id: "ser-caldor",
    name: "Ser Caldor",
    faction: "Sun Court",
    color: "#f1c96b",
    accent: "#ffe6a8",
    stats: { damage: 5, range: 2.85, attackSpeed: 1.05 },
    placement: { kind: "bench", slot: 0 },
    cooldown: 0,
    targetPosition: null
  },
  {
    id: "tovin",
    name: "Tovin",
    faction: "Azure Armada",
    color: "#64b4ff",
    accent: "#b7e3ff",
    stats: { damage: 3, range: 3.45, attackSpeed: 1.35 },
    placement: { kind: "bench", slot: 1 },
    cooldown: 0,
    targetPosition: null
  },
  {
    id: "nyra",
    name: "Nyra",
    faction: "Astral Cloister",
    color: "#ba88ff",
    accent: "#ead5ff",
    stats: { damage: 6, range: 2.55, attackSpeed: 0.95 },
    placement: { kind: "bench", slot: 2 },
    cooldown: 0,
    targetPosition: null
  },
  {
    id: "aurelia",
    name: "Aurelia",
    faction: "Sun Court",
    color: "#f5df82",
    accent: "#fff4bd",
    stats: { damage: 7, range: 2.4, attackSpeed: 0.82 },
    placement: { kind: "bench", slot: 3 },
    cooldown: 0,
    targetPosition: null
  },
  {
    id: "solene",
    name: "Solene",
    faction: "Astral Cloister",
    color: "#f6a0db",
    accent: "#ffe1f5",
    stats: { damage: 4, range: 3.1, attackSpeed: 1.12 },
    placement: { kind: "bench", slot: 4 },
    cooldown: 0,
    targetPosition: null
  },
  {
    id: "scribe-orin",
    name: "Scribe Orin",
    faction: "Astral Cloister",
    color: "#95d8ff",
    accent: "#dcf4ff",
    stats: { damage: 3, range: 3.8, attackSpeed: 1.2 },
    placement: { kind: "bench", slot: 5 },
    cooldown: 0,
    targetPosition: null
  },
  {
    id: "maelis",
    name: "Maelis",
    faction: "Astral Cloister",
    color: "#ce9cff",
    accent: "#f2e1ff",
    stats: { damage: 5, range: 3.0, attackSpeed: 1.0 },
    placement: { kind: "bench", slot: 6 },
    cooldown: 0,
    targetPosition: null
  },
  {
    id: "kael",
    name: "Kael",
    faction: "Azure Armada",
    color: "#75c8ff",
    accent: "#d3f2ff",
    stats: { damage: 6, range: 2.75, attackSpeed: 1.08 },
    placement: { kind: "bench", slot: 7 },
    cooldown: 0,
    targetPosition: null
  }
];

function cloneUnits(): SandboxUnit[] {
  return STARTER_UNITS.map((unit) => ({
    ...unit,
    stats: { ...unit.stats },
    placement: unit.placement.kind === "bench" ? { ...unit.placement } : { kind: "board", coord: { ...unit.placement.coord } },
    cooldown: 0,
    targetPosition: null
  }));
}

function createFoxPack(): WaveEnemy[] {
  return FOX_PACK.map((fox) => ({
    id: fox.id,
    name: fox.name,
    color: "#e27755",
    accent: "#ffd2bf",
    hp: fox.hp,
    maxHp: fox.hp,
    speed: fox.speed,
    spawnDelay: fox.spawnDelay,
    pathProgress: 0,
    position: [...FOX_PATH_POINTS[0]],
    alive: true,
    reachedRelic: false
  }));
}

function getPathLength() {
  let total = 0;
  for (let index = 1; index < FOX_PATH_POINTS.length; index += 1) {
    const previous = FOX_PATH_POINTS[index - 1];
    const current = FOX_PATH_POINTS[index];
    total += Math.hypot(current[0] - previous[0], current[1] - previous[1]);
  }
  return total;
}

const FOX_PATH_LENGTH = getPathLength();

export function getFoxPathPosition(progress: number): [number, number] {
  const targetDistance = Math.min(FOX_PATH_LENGTH, Math.max(0, progress));
  let walked = 0;

  for (let index = 1; index < FOX_PATH_POINTS.length; index += 1) {
    const previous = FOX_PATH_POINTS[index - 1];
    const current = FOX_PATH_POINTS[index];
    const segmentLength = Math.hypot(current[0] - previous[0], current[1] - previous[1]);

    if (walked + segmentLength >= targetDistance) {
      const t = segmentLength > 0 ? (targetDistance - walked) / segmentLength : 0;
      return [
        previous[0] + (current[0] - previous[0]) * t,
        previous[1] + (current[1] - previous[1]) * t
      ];
    }

    walked += segmentLength;
  }

  return [...FOX_PATH_POINTS[FOX_PATH_POINTS.length - 1]];
}

function separateFromDefenders(position: [number, number], units: SandboxUnit[]): [number, number] {
  let x = position[0];
  let z = position[1];

  for (let iteration = 0; iteration < DEFENDER_COLLISION_ITERATIONS; iteration += 1) {
    for (const unit of units) {
      if (unit.placement.kind !== "board") {
        continue;
      }

      const [unitX, , unitZ] = getTileWorldPosition(unit.placement.coord);
      const dx = x - unitX;
      const dz = z - unitZ;
      const distance = Math.hypot(dx, dz);

      if (distance >= DEFENDER_COLLISION_RADIUS) {
        continue;
      }

      const pushX = distance > 0.001 ? dx / distance : 1;
      const pushZ = distance > 0.001 ? dz / distance : 0;
      const push = DEFENDER_COLLISION_RADIUS - distance;
      x += pushX * push;
      z += pushZ * push;
    }
  }

  return [x, z];
}

function createInitialWaveState() {
  return {
    round: 1,
    phase: "planning" as const,
    enemies: createFoxPack(),
    relic: {
      hp: RELIC_MAX_HP,
      maxHp: RELIC_MAX_HP,
      position: [...RELIC_POSITION] as [number, number]
    },
    attackEffects: [],
    nextAttackEffectId: 1,
    log: [
      "Scribe Orin: The fox will weave through the old pilgrim road.",
      "A small fox pack is coming. Place defenders near corners for the longest shots."
    ]
  };
}

export function createInitialBoardState() {
  return {
    units: cloneUnits(),
    selectedUnitId: null,
    draggingUnitId: null,
    wave: createInitialWaveState()
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
      if (get().wave.phase === "active" || !isDefenderCoord(coord) || getBoardOccupant(get().units, coord, id)) {
        return false;
      }

      set((state) => ({
        units: patchPlacement(state.units, id, { kind: "board", coord }),
        selectedUnitId: id
      }));

      return true;
    },
    moveUnitToBench: (id, benchIndex) => {
      if (get().wave.phase === "active") {
        return false;
      }

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
    startWave: () => {
      const deployedUnits = get().units.filter((unit) => unit.placement.kind === "board");

      if (deployedUnits.length === 0) {
        set((state) => ({
          wave: {
            ...state.wave,
            phase: "planning",
            log: ["Aurelia: The relic needs defenders before the fox reaches the first bend."]
          }
        }));
        return;
      }

      set((state) => ({
        units: state.units.map((unit) => ({ ...unit, cooldown: 0, targetPosition: null })),
        wave: {
          ...createInitialWaveState(),
          round: state.wave.round,
          phase: "active",
          log: [
            `Wave ${state.wave.round}: ${deployedUnits.length} defender${deployedUnits.length === 1 ? "" : "s"} holding the shrine path.`,
            "Kael: Corners buy time. Make every shot count."
          ]
        }
      }));
    },
    tickWave: (deltaSeconds) => {
      const state = get();
      if (state.wave.phase !== "active") {
        return;
      }

      const dt = Math.min(Math.max(deltaSeconds, 0), 0.08);
      let enemies = state.wave.enemies.map((enemy) => {
        if (!enemy.alive || enemy.reachedRelic) {
          return enemy;
        }

        const nextSpawnDelay = Math.max(0, enemy.spawnDelay - dt);
        if (nextSpawnDelay > 0) {
          return { ...enemy, spawnDelay: nextSpawnDelay };
        }

        const nextProgress = enemy.pathProgress + enemy.speed * dt;
        const reachedRelic = nextProgress >= FOX_PATH_LENGTH;
        const pathPosition = getFoxPathPosition(nextProgress);

        return {
          ...enemy,
          spawnDelay: 0,
          pathProgress: nextProgress,
          position: separateFromDefenders(pathPosition, state.units),
          reachedRelic,
          alive: !reachedRelic
        };
      });
      let relicHp = state.wave.relic.hp;
      const reachedCount = enemies.reduce((total, enemy) => total + (enemy.reachedRelic && enemy.alive === false ? 1 : 0), 0);
      const previousReachedCount = state.wave.enemies.reduce(
        (total, enemy) => total + (enemy.reachedRelic && enemy.alive === false ? 1 : 0),
        0
      );
      relicHp = Math.max(0, relicHp - Math.max(0, reachedCount - previousReachedCount));
      let nextAttackEffectId = state.wave.nextAttackEffectId;
      const newAttackEffects = state.wave.attackEffects
        .map((effect) => ({ ...effect, age: effect.age + dt }))
        .filter((effect) => effect.age < ATTACK_EFFECT_LIFETIME);

      const units = state.units.map((unit) => {
        if (unit.placement.kind !== "board") {
          return { ...unit, cooldown: Math.max(0, unit.cooldown - dt), targetPosition: null };
        }

        const nextCooldown = Math.max(0, unit.cooldown - dt);
        const [unitX, , unitZ] = getTileWorldPosition(unit.placement.coord);
        const target = enemies
          .filter((enemy) => enemy.alive && !enemy.reachedRelic && enemy.spawnDelay <= 0)
          .map((enemy) => ({
            enemy,
            distance: Math.hypot(unitX - enemy.position[0], unitZ - enemy.position[1])
          }))
          .filter((entry) => entry.distance <= unit.stats.range)
          .sort((a, b) => b.enemy.pathProgress - a.enemy.pathProgress)[0]?.enemy;

        if (target && nextCooldown <= 0) {
          const targetPosition = [...target.position] as [number, number];
          enemies = enemies.map((enemy) =>
            enemy.id === target.id
              ? {
                  ...enemy,
                  hp: Math.max(0, enemy.hp - unit.stats.damage),
                  alive: enemy.hp - unit.stats.damage > 0
                }
              : enemy
          );
          newAttackEffects.push({
            id: nextAttackEffectId,
            unitId: unit.id,
            enemyId: target.id,
            from: [unitX, unitZ],
            to: targetPosition,
            age: 0
          });
          nextAttackEffectId += 1;
          return { ...unit, cooldown: 1 / unit.stats.attackSpeed, targetPosition };
        }

        return { ...unit, cooldown: nextCooldown, targetPosition: target ? [...target.position] as [number, number] : unit.targetPosition };
      });

      const allFoxesHandled = enemies.every((enemy) => !enemy.alive || enemy.reachedRelic);
      const anyFoxEscaped = enemies.some((enemy) => enemy.reachedRelic);

      if (relicHp <= 0) {
        set((current) => ({
          units,
          wave: {
            ...current.wave,
            phase: "lost",
            enemies,
            relic: {
              ...current.wave.relic,
              hp: 0
            },
            attackEffects: newAttackEffects,
            nextAttackEffectId,
            log: [
              "Defeat. The fox pack cracked the relic.",
              "Aurelia: Gather the defenders and try the path again."
            ]
          }
        }));
        return;
      }

      if (allFoxesHandled && !anyFoxEscaped) {
        set((current) => ({
          units,
          wave: {
            ...current.wave,
            phase: "won",
            round: current.wave.round + 1,
            enemies,
            attackEffects: newAttackEffects,
            nextAttackEffectId,
            log: [
              "Victory. The fox pack scatters from the shrine path.",
              "Scribe Orin: The relic is safe, and that was almost graceful."
            ]
          }
        }));
        return;
      }

      const nextPhase = allFoxesHandled && anyFoxEscaped ? "planning" : "active";

      set((current) => ({
        units,
        wave: {
          ...current.wave,
          phase: nextPhase,
          round: allFoxesHandled && anyFoxEscaped ? current.wave.round + 1 : current.wave.round,
          enemies: allFoxesHandled && anyFoxEscaped ? createFoxPack() : enemies,
          relic: {
            ...current.wave.relic,
            hp: relicHp
          },
          attackEffects: newAttackEffects,
          nextAttackEffectId,
          log: allFoxesHandled && anyFoxEscaped
            ? [
                `The fox pack struck the relic. ${relicHp}/${current.wave.relic.maxHp} ward seals remain.`,
                "Tovin: Tighten the corner coverage before they circle back."
              ]
            : current.wave.log
        }
      }));
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

function getTileWorldPosition(coord: BoardCoord): [number, number, number] {
  const x = (coord.col - (BOARD_LAYOUT.cols - 1) / 2) * (BOARD_LAYOUT.tileSize + BOARD_LAYOUT.tileGap);
  const z = (coord.row - (BOARD_LAYOUT.rows - 1) / 2) * (BOARD_LAYOUT.tileSize + BOARD_LAYOUT.tileGap);
  return [x, 0, z];
}
