import { PerformanceOverlay } from "./PerformanceOverlay";
import type { CameraMode } from "./CanvasScene";
import type { SandboxUnit, UnitId } from "../types";

interface HudOverlayProps {
  units: SandboxUnit[];
  selectedUnitId: UnitId | null;
  draggingUnitId: UnitId | null;
  hoveredBenchIndex: number | null;
  cameraMode: CameraMode;
  onBenchHover: (slot: number | null) => void;
  onBenchUnitPointerDown: (unitId: UnitId) => void;
  onToggleCameraMode: () => void;
  onResetView: () => void;
  onReset: () => void;
}

export function HudOverlay(props: HudOverlayProps) {
  return (
    <div className="hud-layer">
      <PerformanceOverlay />
      <header className="hud-topbar">
        <div className="topbar-actions">
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
          <button className="ghost-button" type="button" onClick={props.onReset}>
            Reset Sandbox
          </button>
        </div>
      </header>
    </div>
  );
}
