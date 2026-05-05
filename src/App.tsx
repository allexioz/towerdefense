import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { CanvasScene } from "./components/CanvasScene";
import type { CameraMode } from "./components/CanvasScene";
import { HudOverlay } from "./components/HudOverlay";
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
  const selectUnit = useBoardStore((state) => state.selectUnit);
  const beginDrag = useBoardStore((state) => state.beginDrag);
  const endDrag = useBoardStore((state) => state.endDrag);
  const moveUnitToBoard = useBoardStore((state) => state.moveUnitToBoard);
  const moveUnitToBench = useBoardStore((state) => state.moveUnitToBench);
  const resetSandbox = useBoardStore((state) => state.resetSandbox);

  const [hoveredBoardCoord, setHoveredBoardCoord] = useState<BoardCoord | null>(null);
  const [hoveredBenchIndex, setHoveredBenchIndex] = useState<number | null>(null);
  const [dragCursor, setDragCursor] = useState<DragCursor | null>(null);
  const [cameraResetSignal, setCameraResetSignal] = useState(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>("free");

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

  function startDraggingUnit(unitId: UnitId) {
    selectUnit(unitId);
    beginDrag(unitId);
  }

  return (
    <main className="app-shell">
      <div className="stage-shell">
        <CanvasScene
          units={units}
          selectedUnitId={selectedUnitId}
          draggingUnitId={draggingUnitId}
          hoveredBoardCoord={hoveredBoardCoord}
          cameraResetSignal={cameraResetSignal}
          cameraMode={cameraMode}
          onBoardHover={setHoveredBoardCoord}
          onBoardUnitPointerDown={startDraggingUnit}
          onClearSelection={() => {
            if (!draggingUnitId) {
              selectUnit(null);
            }
          }}
        />

        <HudOverlay
          units={units}
          selectedUnitId={selectedUnitId}
          draggingUnitId={draggingUnitId}
          hoveredBenchIndex={hoveredBenchIndex}
          cameraMode={cameraMode}
          onBenchHover={setHoveredBenchIndex}
          onBenchUnitPointerDown={startDraggingUnit}
          onToggleCameraMode={() => {
            setCameraMode((current) => (current === "free" ? "followFox" : "free"));
          }}
          onResetView={() => {
            setCameraMode("free");
            setCameraResetSignal((current) => current + 1);
          }}
          onReset={() => {
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
