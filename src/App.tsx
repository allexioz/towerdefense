import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasScene } from "./components/CanvasScene";
import type { CameraMode } from "./components/CanvasScene";
import { HudOverlay } from "./components/HudOverlay";
import { gameAudio } from "./audio/sound";
import { boardStore, getBenchOccupant, getBoardOccupant, useBoardStore } from "./state/boardStore";
import type { BoardCoord, UnitId } from "./types";

interface DragCursor {
  x: number;
  y: number;
}

export default function App() {
  const units = useBoardStore((state) => state.units);
  const selectedUnitId = useBoardStore((state) => state.selectedUnitId);
  const draggingUnitId = useBoardStore((state) => state.draggingUnitId);
  const wave = useBoardStore((state) => state.wave);
  const selectUnit = useBoardStore((state) => state.selectUnit);
  const beginDrag = useBoardStore((state) => state.beginDrag);
  const endDrag = useBoardStore((state) => state.endDrag);
  const moveUnitToBoard = useBoardStore((state) => state.moveUnitToBoard);
  const moveUnitToBench = useBoardStore((state) => state.moveUnitToBench);
  const startWave = useBoardStore((state) => state.startWave);
  const tickWave = useBoardStore((state) => state.tickWave);
  const resetSandbox = useBoardStore((state) => state.resetSandbox);

  const [hoveredBoardCoord, setHoveredBoardCoord] = useState<BoardCoord | null>(null);
  const [hoveredBenchIndex, setHoveredBenchIndex] = useState<number | null>(null);
  const [dragCursor, setDragCursor] = useState<DragCursor | null>(null);
  const [cameraResetSignal, setCameraResetSignal] = useState(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>("free");
  const [cameraDragActive, setCameraDragActive] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(gameAudio.isEnabled());
  const lastAttackEffectIdRef = useRef(0);
  const previousWavePhaseRef = useRef(wave.phase);
  const previousRelicHpRef = useRef(wave.relic.hp);
  const previousLogSignatureRef = useRef(wave.log.join("|"));

  const draggingUnit = useMemo(
    () => units.find((unit) => unit.id === draggingUnitId) ?? null,
    [draggingUnitId, units]
  );

  useEffect(() => {
    if (!draggingUnitId) {
      setDragCursor(null);
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      setDragCursor({ x: event.clientX, y: event.clientY });
    }

    function handlePointerUp() {
      const store = boardStore.getState();
      const activeUnitId = store.draggingUnitId;
      if (!activeUnitId) {
        return;
      }

      let placed = false;
      if (hoveredBoardCoord) {
        const targetOccupied = getBoardOccupant(store.units, hoveredBoardCoord, activeUnitId);
        if (!targetOccupied) {
          placed = moveUnitToBoard(activeUnitId, hoveredBoardCoord);
        }
      } else if (hoveredBenchIndex !== null) {
        const slotOccupied = getBenchOccupant(store.units, hoveredBenchIndex, activeUnitId);
        if (!slotOccupied) {
          placed = moveUnitToBench(activeUnitId, hoveredBenchIndex);
        }
      }

      if (placed) {
        gameAudio.place();
      } else {
        gameAudio.slide();
      }

      if (!placed) {
        store.selectUnit(activeUnitId);
      }

      endDrag();
      setHoveredBoardCoord(null);
      setHoveredBenchIndex(null);
      setDragCursor(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingUnitId, endDrag, hoveredBenchIndex, hoveredBoardCoord, moveUnitToBench, moveUnitToBoard]);

  useEffect(() => {
    function isInteractiveElement(target: EventTarget | null): boolean {
      return target instanceof HTMLElement && (target.isContentEditable || target.closest("button") !== null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" || event.repeat || isInteractiveElement(event.target)) {
        return;
      }

      event.preventDefault();
      setCameraDragActive(true);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space") {
        return;
      }

      event.preventDefault();
      setCameraDragActive(false);
    }

    function handleBlur() {
      setCameraDragActive(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    const newestEffectId = wave.attackEffects.reduce((highest, effect) => Math.max(highest, effect.id), 0);
    if (newestEffectId > lastAttackEffectIdRef.current) {
      gameAudio.attack();
      lastAttackEffectIdRef.current = newestEffectId;
    }
  }, [wave.attackEffects]);

  useEffect(() => {
    const previousPhase = previousWavePhaseRef.current;
    if (previousPhase !== wave.phase) {
      if (wave.phase === "active") {
        lastAttackEffectIdRef.current = 0;
        gameAudio.alert();
      } else if (wave.phase === "won") {
        gameAudio.alert();
      } else if (wave.phase === "lost") {
        gameAudio.impact();
      }
      previousWavePhaseRef.current = wave.phase;
    }
  }, [wave.phase]);

  useEffect(() => {
    if (wave.relic.hp < previousRelicHpRef.current) {
      gameAudio.impact();
    }
    previousRelicHpRef.current = wave.relic.hp;
  }, [wave.relic.hp]);

  useEffect(() => {
    const signature = wave.log.join("|");
    if (signature !== previousLogSignatureRef.current) {
      gameAudio.dialogue();
      previousLogSignatureRef.current = signature;
    }
  }, [wave.log]);

  function startDraggingUnit(unitId: UnitId) {
    if (cameraDragActive) {
      return;
    }
    if (boardStore.getState().wave.phase === "active") {
      gameAudio.click();
      selectUnit(unitId);
      return;
    }

    gameAudio.click();
    selectUnit(unitId);
    beginDrag(unitId);
  }

  function handleBoardTilePointerDown(coord: BoardCoord) {
    if (cameraDragActive || draggingUnitId) {
      return;
    }

    const selectedUnit = units.find((unit) => unit.id === selectedUnitId);
    if (selectedUnit?.placement.kind === "bench") {
      if (moveUnitToBoard(selectedUnit.id, coord)) {
        gameAudio.place();
      } else {
        gameAudio.impact();
      }
      return;
    }

    gameAudio.click();
    selectUnit(null);
  }

  return (
    <main className="app-shell">
      <div className="stage-shell">
        <CanvasScene
          units={units}
          selectedUnitId={selectedUnitId}
          draggingUnitId={draggingUnitId}
          wave={wave}
          hoveredBoardCoord={hoveredBoardCoord}
          cameraResetSignal={cameraResetSignal}
          cameraMode={cameraMode}
          cameraDragActive={cameraDragActive}
          onWaveTick={tickWave}
          onBoardHover={setHoveredBoardCoord}
          onBoardTilePointerDown={handleBoardTilePointerDown}
          onBoardUnitPointerDown={startDraggingUnit}
          onClearSelection={() => {
            if (!draggingUnitId && !cameraDragActive) {
              selectUnit(null);
            }
          }}
        />

        <HudOverlay
          units={units}
          selectedUnitId={selectedUnitId}
          draggingUnitId={draggingUnitId}
          wave={wave}
          hoveredBenchIndex={hoveredBenchIndex}
          cameraMode={cameraMode}
          audioEnabled={audioEnabled}
          onBenchHover={setHoveredBenchIndex}
          onBenchUnitPointerDown={startDraggingUnit}
          onToggleCameraMode={() => {
            gameAudio.click();
            setCameraMode((current) => (current === "free" ? "followFox" : "free"));
          }}
          onResetView={() => {
            gameAudio.click();
            setCameraMode("free");
            setCameraResetSignal((current) => current + 1);
          }}
          onStartWave={() => {
            gameAudio.click();
            startWave();
          }}
          onToggleAudio={() => {
            setAudioEnabled(gameAudio.toggle());
          }}
          onReset={() => {
            gameAudio.click();
            resetSandbox();
            setHoveredBoardCoord(null);
            setHoveredBenchIndex(null);
            setDragCursor(null);
            setCameraMode("free");
            setCameraResetSignal((current) => current + 1);
          }}
        />

        {draggingUnit && dragCursor ? (
          <div
            className="drag-ghost"
            style={
              {
                left: dragCursor.x,
                top: dragCursor.y,
                "--unit-color": draggingUnit.color,
                "--unit-accent": draggingUnit.accent
              } as CSSProperties
            }
          >
            <span className="drag-ghost-glyph" />
            <span>{draggingUnit.name}</span>
          </div>
        ) : null}
      </div>
    </main>
  );
}
