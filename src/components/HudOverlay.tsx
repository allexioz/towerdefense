import { PerformanceOverlay } from "./PerformanceOverlay";
import type { CameraMode } from "./CanvasScene";
import { BOARD_LAYOUT } from "../config/layout";
import type { SandboxUnit, UnitId, WaveState } from "../types";
import { useMemo, type CSSProperties } from "react";

interface HudOverlayProps {
  units: SandboxUnit[];
  selectedUnitId: UnitId | null;
  draggingUnitId: UnitId | null;
  hoveredBenchIndex: number | null;
  cameraMode: CameraMode;
  audioEnabled: boolean;
  wave: WaveState;
  onBenchHover: (slot: number | null) => void;
  onBenchUnitPointerDown: (unitId: UnitId) => void;
  onToggleCameraMode: () => void;
  onResetView: () => void;
  onStartWave: () => void;
  onToggleAudio: () => void;
  onReset: () => void;
}

export function HudOverlay(props: HudOverlayProps) {
  const selectedUnit = props.units.find((unit) => unit.id === props.selectedUnitId) ?? null;
  const benchSlots = useMemo(() => {
    const unitBySlot = new Map<number, SandboxUnit>();
    for (const unit of props.units) {
      if (unit.placement.kind === "bench") {
        unitBySlot.set(unit.placement.slot, unit);
      }
    }

    return Array.from({ length: BOARD_LAYOUT.benchSlots }, (_, slot) => ({
      slot,
      unit: unitBySlot.get(slot) ?? null
    }));
  }, [props.units]);
  const deployedCount = useMemo(
    () => props.units.reduce((total, unit) => total + (unit.placement.kind === "board" ? 1 : 0), 0),
    [props.units]
  );
  const readinessLabel = `${deployedCount} deployed / ${props.units.length} ready`;
  const activeFoxes = props.wave.enemies.filter((enemy) => enemy.alive && !enemy.reachedRelic && enemy.spawnDelay <= 0);
  const remainingFoxes = props.wave.enemies.filter((enemy) => enemy.alive && !enemy.reachedRelic);
  const leadFox = activeFoxes.sort((a, b) => b.pathProgress - a.pathProgress)[0] ?? remainingFoxes[0] ?? null;
  const waveLabel =
    props.wave.phase === "won"
      ? "Relic Defended"
      : props.wave.phase === "lost"
        ? "Relic Broken"
        : props.wave.phase === "active"
          ? "Wave Active"
          : "Planning";
  const startDisabled = props.wave.phase === "active";

  return (
    <div className="hud-layer">
      <PerformanceOverlay />
      <header className="hud-topbar">
        <div className="hud-title">
          <p className="eyebrow">Wave {props.wave.round}</p>
          <h1>Sky Defense</h1>
          <p className="selection-copy">
            {selectedUnit
              ? `${selectedUnit.name} | ${selectedUnit.stats.damage} damage / ${selectedUnit.stats.range.toFixed(
                  1
                )} range / ${selectedUnit.stats.attackSpeed.toFixed(2)} shots per sec`
              : `${deployedCount} defender${deployedCount === 1 ? "" : "s"} watching a ${props.wave.enemies.length}-fox pack.`}
          </p>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button is-primary" type="button" onClick={props.onStartWave} disabled={startDisabled}>
            Start Wave
          </button>
          <button
            className={`ghost-button is-secondary${props.cameraMode === "followFox" ? " is-active" : ""}`}
            type="button"
            onClick={props.onToggleCameraMode}
          >
            {props.cameraMode === "followFox" ? "Free Camera" : "Follow Fox"}
          </button>
          <button className="ghost-button is-secondary" type="button" onClick={props.onResetView}>
            Reset View
          </button>
          <button
            className={`ghost-button is-secondary${props.audioEnabled ? " is-active" : ""}`}
            type="button"
            onClick={props.onToggleAudio}
          >
            {props.audioEnabled ? "Sound On" : "Sound Off"}
          </button>
          <button className="ghost-button" type="button" onClick={props.onReset}>
            Reset Level
          </button>
        </div>
      </header>

      <section className="combat-panel" aria-live="polite">
        <div className="wave-panel-head">
          <div>
            <p className="eyebrow">Relic Defense</p>
            <strong>{waveLabel}</strong>
          </div>
          <div className="wave-vitals" aria-label="Wave vitals">
            <span>Relic {props.wave.relic.hp}/{props.wave.relic.maxHp}</span>
            <span>Foxes {remainingFoxes.length}/{props.wave.enemies.length}</span>
            <span>Lead {leadFox ? `${Math.ceil(leadFox.hp)}/${leadFox.maxHp}` : "Clear"}</span>
          </div>
        </div>
        <ul>
          {props.wave.log.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>

      <section className="bench-dock" aria-label="Unit bench">
        <div className="bench-heading">
          <div>
            <p className="eyebrow">Roster</p>
            <h2>Defenders</h2>
          </div>
          <p className="bench-readiness">{readinessLabel}</p>
        </div>
        <div className="bench-row">
          {benchSlots.map(({ slot, unit }) => (
            <div
              key={slot}
              className={`bench-slot${props.hoveredBenchIndex === slot ? " is-hovered" : ""}`}
              onPointerEnter={() => props.onBenchHover(slot)}
              onPointerLeave={() => props.onBenchHover(null)}
            >
              {unit ? (
                <button
                  className={`bench-unit${props.selectedUnitId === unit.id ? " is-selected" : ""}${
                    props.draggingUnitId === unit.id ? " is-dragging" : ""
                  }`}
                  style={{ "--unit-color": unit.color, "--unit-accent": unit.accent } as CSSProperties}
                  type="button"
                  aria-label={`${unit.name}, ${unit.stats.damage} damage, ${unit.stats.range} range`}
                  onPointerDown={(event) => {
                    if (event.button !== 0) {
                      return;
                    }
                    props.onBenchUnitPointerDown(unit.id);
                  }}
                >
                  <span className="bench-unit-glyph" />
                  <span className="bench-unit-name">{unit.name}</span>
                  <span className="bench-unit-stats">
                    {unit.stats.damage} DMG / {unit.stats.range.toFixed(1)} RNG
                  </span>
                </button>
              ) : (
                <span className="bench-empty-mark" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
