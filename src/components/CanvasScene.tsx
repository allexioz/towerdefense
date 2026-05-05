import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Clone, ContactShadows, useAnimations, useGLTF } from "@react-three/drei";
import CameraControlsImpl from "camera-controls";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { BOARD_DEPTH, BOARD_LAYOUT, BOARD_WIDTH, getTilePosition, isPlayerCoord } from "../config/layout";
import { usePerformanceStore } from "../state/performanceStore";
import type { BoardCoord, SandboxUnit, UnitId } from "../types";

CameraControlsImpl.install({ THREE });

const CAMERA_TARGET_BOUNDARY_PADDING = 2.2;
const KEYBOARD_ROTATE_STEP = Math.PI / 48;
const KEYBOARD_TRUCK_STEP = 0.36;
const KEYBOARD_DOLLY_STEP = 0.7;
const GRASS_SWAY_MAX_ANGLE = 0.18;
const TREE_SWAY_MAX_ANGLE = 0.028;
const ALTAR_FLAME_SWAY_MAX_ANGLE = 0.11;
const FOX_GROUND_CLEARANCE = 0.012;
const FOX_MIN_SPEED = 0.24;
const FOX_MAX_SPEED = 0.56;
const FOX_WANDER_WEIGHT = 0.7;
const FOX_BOUNDARY_WEIGHT = 1.8;
const FOX_ISLAND_RADIUS_X = BOARD_WIDTH / 2 + 5.2;
const FOX_ISLAND_RADIUS_Z = BOARD_DEPTH / 2 + 4.8;
const FOX_ISLAND_CENTER_Z = 0.42;
const FOX_WALKABLE_EDGE_LIMIT = 0.9;
const FOX_MIN_GROUND_Y = -0.12;
const SHRINE_CORRIDOR_HALF_WIDTH = 4.2;
const SHRINE_CORRIDOR_MIN_Z = -BOARD_DEPTH / 2 - 5.7;
const SHRINE_CORRIDOR_MAX_Z = -BOARD_DEPTH / 2 - 1.0;
const ENTRY_PATH_HALF_WIDTH = 1.22;
const ENTRY_PATH_MIN_Z = BOARD_DEPTH / 2 + 0.7;
const ENTRY_PATH_MAX_Z = BOARD_DEPTH / 2 + 5.6;
const ISLAND_MODEL_URL = new URL("../../glb/Meshy_AI_Verdant_Floating_Isla_0505075319_texture.glb", import.meta.url).href;
const SIGNPOST_MODEL_URL = new URL("../../glb/Meshy_AI_Wooden_Signpost_with__0505095605_texture.glb", import.meta.url).href;
const ARCANE_ALTAR_MODEL_URL = new URL("../../glb/Meshy_AI_Arcane_Altar_0505095808_texture.glb", import.meta.url).href;
const STONE_ARCH_MODEL_URL = new URL("../../glb/Meshy_AI_Verdant_Stone_Arch_0505095902_texture.glb", import.meta.url).href;
const STONE_LANTERN_MODEL_URL = new URL("../../glb/Meshy_AI_Japanese_Stone_Lanter_0505095918_texture.glb", import.meta.url).href;
const FACETED_STONE_PILE_MODEL_URL = new URL("../../glb/Meshy_AI_Faceted_Stone_Pile_0505102700_texture.glb", import.meta.url).href;
const FOX_MODEL_URL = new URL("../../glb/Meshy_AI_Geode_Fox_quadruped_model_Animation_Walking_withSkin.glb", import.meta.url).href;
const TREE_MODEL_URLS = {
  blossom: new URL("../../glb/Meshy_AI_Cherry_Blossom_Tree_0505071036_texture.glb", import.meta.url).href,
  layeredPine: new URL("../../glb/Meshy_AI_Layered_Paper_Pine_0505071115_texture.glb", import.meta.url).href,
  lowPoly: new URL("../../glb/Meshy_AI_Low_Poly_Tree_0505071138_texture.glb", import.meta.url).href,
  pink: new URL("../../glb/Meshy_AI_Pink_Polygonal_Tree_0505071149_texture.glb", import.meta.url).href,
  polygonalPine: new URL("../../glb/Meshy_AI_Polygonal_Pine_0505071129_texture.glb", import.meta.url).href,
  polygonalTree: new URL("../../glb/Meshy_AI_Polygonal_Tree_0505071103_texture.glb", import.meta.url).href
} as const;
interface CanvasSceneProps {
  units: SandboxUnit[];
  selectedUnitId: UnitId | null;
  draggingUnitId: UnitId | null;
  hoveredBoardCoord: BoardCoord | null;
  cameraResetSignal: number;
  cameraMode: CameraMode;
  onBoardHover: (coord: BoardCoord | null) => void;
  onBoardUnitPointerDown: (unitId: UnitId) => void;
  onClearSelection: () => void;
}

export type CameraMode = "free" | "followFox";

const PAVER_TONES = ["#9c9679", "#a8a181", "#8f896d", "#b2ab8a"] as const;

function seededNoise(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function isInsideShrineCorridor(x: number, z: number) {
  return Math.abs(x) < SHRINE_CORRIDOR_HALF_WIDTH && z >= SHRINE_CORRIDOR_MIN_Z && z <= SHRINE_CORRIDOR_MAX_Z;
}

function isInsideEntryPath(x: number, z: number) {
  return Math.abs(x) < ENTRY_PATH_HALF_WIDTH && z >= ENTRY_PATH_MIN_Z && z <= ENTRY_PATH_MAX_Z;
}

function isInsidePathApron(x: number, z: number) {
  return Math.abs(x) < ENTRY_PATH_HALF_WIDTH + 0.72 && z >= ENTRY_PATH_MIN_Z - 0.8 && z <= ENTRY_PATH_MAX_Z;
}

function usePreparedTree(url: string) {
  const gltf = useGLTF(url);

  return useMemo(() => {
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    const lift = Math.max(0, -bounds.min.y) + 0.02;

    return {
      scene: gltf.scene,
      lift,
      bounds,
      size,
      center
    };
  }, [gltf.scene]);
}

function useIslandSurfaceSampler() {
  const island = usePreparedTree(ISLAND_MODEL_URL);

  return useMemo(() => {
    const targetWidth = BOARD_WIDTH + 20;
    const targetDepth = BOARD_DEPTH + 18;
    const scale = Math.min(targetWidth / island.size.x, targetDepth / island.size.z);
    const topY = -0.1;
    const plateauMinY = topY - 0.22;
    const baseY = topY - island.bounds.max.y * scale;
    const position = new THREE.Vector3(-island.center.x * scale, baseY, 0.42 - island.center.z * scale);

    const probe = island.scene.clone(true);
    probe.position.copy(position);
    probe.scale.setScalar(scale);
    probe.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);

    function sampleHeight(x: number, z: number, fallbackY: number) {
      raycaster.set(new THREE.Vector3(x, 24, z), down);
      const hits = raycaster.intersectObject(probe, true);
      return hits[0]?.point.y ?? fallbackY;
    }

    function sampleTopHeight(x: number, z: number, fallbackY: number) {
      raycaster.set(new THREE.Vector3(x, 24, z), down);
      const hits = raycaster.intersectObject(probe, true);
      const plateauHit = hits.find((hit) => hit.point.y >= plateauMinY);
      return plateauHit?.point.y ?? fallbackY;
    }

    return {
      island,
      scale,
      position,
      topY,
      plateauMinY,
      sampleHeight,
      sampleTopHeight
    };
  }, [island]);
}

function BoardTile({
  coord,
  highlighted,
  selected,
  onHover,
  onClick
}: {
  coord: BoardCoord;
  highlighted: boolean;
  selected: boolean;
  onHover: (coord: BoardCoord | null) => void;
  onClick: () => void;
}) {
  const [x, y, z] = getTilePosition(coord);
  const isPlayer = isPlayerCoord(coord);
  const seed = coord.col * 37 + coord.row * 101;
  const tone = PAVER_TONES[(coord.col + coord.row) % PAVER_TONES.length];
  const rimColor = selected ? "#8a7b4f" : highlighted ? "#7f7756" : "#726a52";
  const topColor = selected ? "#c4b581" : highlighted ? "#b2ab85" : tone;
  const mossTint = isPlayer ? "#61774f" : "#6b7654";
  const offsetX = (seededNoise(seed + 2) - 0.5) * 0.06;
  const offsetZ = (seededNoise(seed + 6) - 0.5) * 0.06;
  const scaleX = 0.88 + seededNoise(seed + 12) * 0.05;
  const scaleZ = 0.88 + seededNoise(seed + 18) * 0.05;
  const tiltY = (seededNoise(seed + 28) - 0.5) * 0.05;

  return (
    <group
      position={[x, y, z]}
      onPointerEnter={(event) => {
        event.stopPropagation();
        onHover(coord);
      }}
      onPointerLeave={(event) => {
        event.stopPropagation();
        onHover(null);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        event.stopPropagation();
        onClick();
      }}
    >
      <mesh castShadow receiveShadow position={[0, -0.035, 0]}>
        <boxGeometry args={[BOARD_LAYOUT.tileSize - 0.02, 0.08, BOARD_LAYOUT.tileSize - 0.02]} />
        <meshStandardMaterial color={rimColor} roughness={0.98} metalness={0.02} />
      </mesh>
      <mesh castShadow receiveShadow position={[offsetX, 0.022, offsetZ]} rotation={[0, tiltY, 0]}>
        <boxGeometry
          args={[
            (BOARD_LAYOUT.tileSize - 0.14) * scaleX,
            0.055,
            (BOARD_LAYOUT.tileSize - 0.14) * scaleZ
          ]}
        />
        <meshStandardMaterial
          color={topColor}
          roughness={0.95}
          metalness={0.02}
          emissive={highlighted ? "#5b6441" : mossTint}
          emissiveIntensity={highlighted ? 0.22 : 0.04}
        />
      </mesh>
      <mesh castShadow receiveShadow position={[offsetX * 0.45, 0.056, offsetZ * 0.4]} rotation={[0, tiltY * 0.55, 0]}>
        <boxGeometry
          args={[
            (BOARD_LAYOUT.tileSize - 0.3) * scaleX,
            0.007,
            (BOARD_LAYOUT.tileSize - 0.3) * scaleZ
          ]}
        />
        <meshStandardMaterial
          color={selected ? "#d7ca9d" : highlighted ? "#c8c09b" : "#b9b292"}
          roughness={0.9}
          metalness={0.01}
        />
      </mesh>
    </group>
  );
}

function UnitPiece({
  unit,
  selected,
  onPointerDown
}: {
  unit: SandboxUnit;
  selected: boolean;
  onPointerDown: () => void;
}) {
  if (unit.placement.kind !== "board") {
    return null;
  }

  const [x, , z] = getTilePosition(unit.placement.coord);

  return (
    <group
      position={[x, 0.14, z]}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        event.stopPropagation();
        onPointerDown();
      }}
    >
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.34, 0.22, 24]} />
        <meshStandardMaterial color={unit.color} roughness={0.42} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial color={unit.accent} roughness={0.3} metalness={0.16} />
      </mesh>
      <mesh position={[0, 0.16, 0.18]} castShadow rotation={[Math.PI / 2.8, 0, 0]}>
        <coneGeometry args={[0.08, 0.28, 18]} />
        <meshStandardMaterial color={unit.accent} roughness={0.22} metalness={0.24} />
      </mesh>
      {selected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
          <torusGeometry args={[0.42, 0.03, 12, 48]} />
          <meshBasicMaterial color="#fff4c7" />
        </mesh>
      ) : null}
    </group>
  );
}

function ArenaFrame() {
  const soilMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#756246",
        roughness: 1,
        metalness: 0
      }),
    []
  );
  const curbMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#cfc7b2",
        roughness: 0.8,
        metalness: 0.04
      }),
    []
  );
  const groutMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#bbb395",
        roughness: 0.96,
        metalness: 0.01
      }),
    []
  );
  const turfInsetMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#89ab69",
        roughness: 1,
        metalness: 0
      }),
    []
  );

  return (
    <group>
      <mesh receiveShadow position={[0, -0.17, 0.42]}>
        <boxGeometry args={[BOARD_WIDTH + 2.55, 0.14, BOARD_DEPTH + 3.15]} />
        <primitive object={soilMaterial} attach="material" />
      </mesh>
      <mesh receiveShadow position={[0, -0.095, 0.42]}>
        <boxGeometry args={[BOARD_WIDTH + 1.7, 0.06, BOARD_DEPTH + 2.2]} />
        <primitive object={turfInsetMaterial} attach="material" />
      </mesh>
      <mesh receiveShadow position={[0, -0.03, 0.42]}>
        <boxGeometry args={[BOARD_WIDTH + 1.18, 0.04, BOARD_DEPTH + 1.72]} />
        <primitive object={curbMaterial} attach="material" />
      </mesh>
      <mesh receiveShadow position={[0, -0.014, 0.42]}>
        <boxGeometry args={[BOARD_WIDTH + 0.34, 0.02, BOARD_DEPTH + 0.34]} />
        <primitive object={groutMaterial} attach="material" />
      </mesh>
    </group>
  );
}

function EntryPath() {
  const apronMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#cbdcb6",
        roughness: 1,
        metalness: 0
      }),
    []
  );

  return (
    <group>
      <mesh receiveShadow position={[0, -0.149, ENTRY_PATH_MIN_Z - 0.36]}>
        <boxGeometry args={[BOARD_WIDTH + 1.65, 0.024, 0.68]} />
        <primitive object={apronMaterial} attach="material" />
      </mesh>
    </group>
  );
}

function FloatingIsland() {
  const islandSurface = useIslandSurfaceSampler();

  return (
    <group
      position={islandSurface.position}
      scale={islandSurface.scale}
      raycast={() => null}
    >
      <Clone object={islandSurface.island.scene} />
    </group>
  );
}

function SkyDome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          topColor: { value: new THREE.Color("#4a8fd9") },
          horizonColor: { value: new THREE.Color("#d7ecff") },
          floorGlow: { value: new THREE.Color("#9fc7f0") },
          sunColor: { value: new THREE.Color("#fff6cf") },
          sunDirection: { value: new THREE.Vector3(0.38, 0.78, 0.2).normalize() }
        },
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          uniform vec3 floorGlow;
          uniform vec3 sunColor;
          uniform vec3 sunDirection;
          varying vec3 vWorldPosition;

          void main() {
            vec3 dir = normalize(vWorldPosition);
            float h = dir.y * 0.5 + 0.5;
            vec3 color = mix(floorGlow, horizonColor, smoothstep(0.04, 0.46, h));
            color = mix(color, topColor, smoothstep(0.48, 0.98, h));
            float sunAmount = max(dot(dir, normalize(sunDirection)), 0.0);
            color += sunColor * pow(sunAmount, 48.0) * 0.18;
            color += sunColor * pow(sunAmount, 6.0) * 0.06;
            gl_FragColor = vec4(color, 1.0);
          }
        `
      }),
    []
  );

  return (
    <mesh position={[0, 6, 0]}>
      <sphereGeometry args={[46, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function CloudSea() {
  const cloudMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#f3fbff",
        transparent: true,
        opacity: 0.74,
        depthWrite: false
      }),
    []
  );
  const cloudShadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#d8ebfb",
        transparent: true,
        opacity: 0.42,
        depthWrite: false
      }),
    []
  );

  const layers = [
    { radius: 40, y: -2.9, scaleX: 1.55, scaleZ: 1.18, material: cloudShadowMaterial },
    { radius: 34, y: -2.3, scaleX: 1.3, scaleZ: 1.02, material: cloudMaterial },
    { radius: 28, y: -1.75, scaleX: 1.08, scaleZ: 0.9, material: cloudMaterial }
  ];

  return (
    <group>
      {layers.map((layer, index) => (
        <mesh
          key={index}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, layer.y, 0.42]}
          scale={[layer.scaleX, 1, layer.scaleZ]}
          raycast={() => null}
        >
          <circleGeometry args={[layer.radius, 96]} />
          <primitive object={layer.material} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

function GrassTuft({
  x,
  y,
  z,
  scale,
  rotation,
  tone,
  seed
}: {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  tone: number;
  seed: number;
}) {
  const swayRef = useRef<THREE.Group>(null);
  const swaySettings = useMemo(
    () => ({
      amplitudeX: (0.45 + seededNoise(seed + 10) * 0.55) * GRASS_SWAY_MAX_ANGLE,
      amplitudeZ: (0.35 + seededNoise(seed + 20) * 0.65) * GRASS_SWAY_MAX_ANGLE,
      speed: 1.6 + seededNoise(seed + 30) * 1.1,
      phase: seededNoise(seed + 40) * Math.PI * 2,
      secondaryPhase: seededNoise(seed + 50) * Math.PI * 2
    }),
    [seed]
  );

  useFrame(({ clock }) => {
    const sway = swayRef.current;
    if (!sway) {
      return;
    }

    const time = clock.elapsedTime * swaySettings.speed + swaySettings.phase;
    sway.rotation.x = Math.sin(time) * swaySettings.amplitudeX;
    sway.rotation.z =
      Math.cos(time * 1.18 + swaySettings.secondaryPhase) * swaySettings.amplitudeZ +
      Math.sin(time * 0.45) * swaySettings.amplitudeZ * 0.3;
  });

  return (
    <group position={[x, y, z]} rotation={[0, rotation, 0]} scale={scale}>
      <group ref={swayRef}>
        <mesh castShadow receiveShadow raycast={() => null} position={[-0.05, 0.09, 0]}>
          <coneGeometry args={[0.05, 0.24, 5]} />
          <meshStandardMaterial
            color={tone > 0.55 ? "#6a8f4d" : "#5f8345"}
            roughness={1}
            metalness={0}
          />
        </mesh>
        <mesh castShadow receiveShadow raycast={() => null} position={[0.02, 0.11, 0.01]} rotation={[0, 0.2, 0]}>
          <coneGeometry args={[0.05, 0.28, 5]} />
          <meshStandardMaterial
            color={tone > 0.35 ? "#7fa65d" : "#6f9850"}
            roughness={1}
            metalness={0}
          />
        </mesh>
        <mesh castShadow receiveShadow raycast={() => null} position={[0.06, 0.08, -0.02]} rotation={[0, -0.2, 0]}>
          <coneGeometry args={[0.04, 0.22, 5]} />
          <meshStandardMaterial color="#567742" roughness={1} metalness={0} />
        </mesh>
      </group>
    </group>
  );
}

function PerimeterGrass() {
  const tufts = useMemo(
    () =>
      [
        [-4.18, -3.62, 1.35], [-3.82, -3.92, 1.02], [-2.6, -4.38, 0.92], [-0.88, -4.5, 0.82],
        [0.82, -4.5, 0.84], [2.48, -4.28, 0.96], [3.75, -3.88, 1.12], [4.12, -3.46, 1.28],
        [-4.72, -0.92, 1.2], [-4.62, -0.18, 0.94], [-4.5, 0.82, 1.12], [-4.18, 1.62, 0.86],
        [4.42, -1.15, 1.18], [4.56, -0.26, 0.96], [4.5, 0.78, 1.08], [4.18, 1.7, 0.9],
        [-4.35, 3.02, 1.02], [-3.72, 3.55, 0.86], [-1.0, 4.32, 0.72], [0.1, 4.42, 0.78],
        [1.18, 4.28, 0.72], [3.72, 3.42, 0.96], [4.28, 2.82, 1.1],
        [-2.16, -5.34, 1.08], [-1.62, -5.22, 0.86], [1.64, -5.22, 0.9], [2.16, -5.36, 1.04],
        [-5.5, -2.58, 0.82], [-5.9, 1.74, 0.9], [5.58, -2.42, 0.82], [5.92, 1.56, 0.92],
        [-5.2, 4.26, 0.98], [-4.62, 4.6, 0.8], [4.72, 4.36, 0.84], [5.28, 4.06, 1.0],
        [-0.34, -5.42, 0.72], [0.38, -5.38, 0.74], [-3.14, 4.18, 0.68], [3.04, 4.06, 0.7]
      ].map(([x, z, scale], index) => ({
        x,
        y: -0.08,
        z,
        scale,
        rotation: seededNoise(index + 130) * Math.PI,
        tone: seededNoise(index + 160),
        seed: index
      })),
    []
  );

  return (
    <group>
      {tufts.map((entry, index) => (
        <GrassTuft
          key={index}
          {...entry}
        />
      ))}
    </group>
  );
}

function StoneScatter() {
  const islandSurface = useIslandSurfaceSampler();

  const stones = useMemo(
    () =>
      [
        [-5.15, 3.05, 0.32], [-4.76, 2.72, 0.22], [-5.42, 2.42, 0.18],
        [4.95, 3.04, 0.28], [5.36, 2.62, 0.2],
        [-4.88, -2.3, 0.22], [4.86, -2.18, 0.22],
        [5.14, -4.55, 0.34], [4.62, -4.22, 0.24],
        [-5.1, -4.4, 0.32], [-4.64, -4.08, 0.22],
        [-0.45, 4.62, 0.14], [0.46, 4.5, 0.14]
      ].map(([x, z, scale], index) => ({
        position: [x, islandSurface.sampleHeight(x, z, -0.08) + 0.015, z] as [number, number, number],
        scale,
        rotation: seededNoise(index + 2000) * Math.PI,
        tint: seededNoise(index + 2200)
      })),
    [islandSurface]
  );

  return (
    <group>
      {stones.map((stone, index) => (
        <mesh
          key={index}
          castShadow
          receiveShadow
          position={stone.position}
          rotation={[0, stone.rotation, 0]}
          scale={[1.2 * stone.scale, stone.scale, 0.9 * stone.scale]}
          raycast={() => null}
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={stone.tint > 0.58 ? "#a6a28c" : stone.tint > 0.26 ? "#8f8a76" : "#7d7a69"}
            roughness={1}
            metalness={0.02}
          />
        </mesh>
      ))}
    </group>
  );
}

function TreeInstance({
  model,
  lift,
  position,
  rotation,
  scale,
  seed
}: {
  model: THREE.Object3D;
  lift: number;
  position: [number, number, number];
  rotation: number;
  scale: number;
  seed: number;
}) {
  const swayRef = useRef<THREE.Group>(null);
  const swaySettings = useMemo(
    () => ({
      amplitudeX: (0.35 + seededNoise(seed + 10) * 0.65) * TREE_SWAY_MAX_ANGLE,
      amplitudeZ: (0.35 + seededNoise(seed + 20) * 0.65) * TREE_SWAY_MAX_ANGLE,
      speed: 0.4 + seededNoise(seed + 30) * 0.35,
      phase: seededNoise(seed + 40) * Math.PI * 2
    }),
    [seed]
  );

  useFrame(({ clock }) => {
    const sway = swayRef.current;
    if (!sway) {
      return;
    }

    const time = clock.elapsedTime * swaySettings.speed + swaySettings.phase;
    sway.rotation.x = Math.sin(time) * swaySettings.amplitudeX;
    sway.rotation.z = Math.cos(time * 0.92) * swaySettings.amplitudeZ;
  });

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale} raycast={() => null}>
      <group ref={swayRef}>
        <group position={[0, lift, 0]}>
          <Clone object={model} />
        </group>
      </group>
    </group>
  );
}

function TreeScatter() {
  const islandSurface = useIslandSurfaceSampler();
  const blossomTree = usePreparedTree(TREE_MODEL_URLS.blossom);
  const layeredPine = usePreparedTree(TREE_MODEL_URLS.layeredPine);
  const lowPolyTree = usePreparedTree(TREE_MODEL_URLS.lowPoly);
  const pinkTree = usePreparedTree(TREE_MODEL_URLS.pink);
  const polygonalPine = usePreparedTree(TREE_MODEL_URLS.polygonalPine);
  const polygonalTree = usePreparedTree(TREE_MODEL_URLS.polygonalTree);

  const library = [blossomTree, layeredPine, lowPolyTree, pinkTree, polygonalPine, polygonalTree];

  const placements = useMemo(
    () =>
      [
        { model: 2, x: -6.55, z: -2.32, rotation: 0.16, scale: 1.08 },
        { model: 4, x: -6.15, z: -0.92, rotation: -0.28, scale: 0.92 },
        { model: 1, x: -6.32, z: 1.14, rotation: 0.34, scale: 0.96 },
        { model: 3, x: -6.08, z: 3.45, rotation: -0.48, scale: 1.08 },
        { model: 0, x: -4.18, z: -4.98, rotation: 0.54, scale: 0.86 },
        { model: 3, x: -4.58, z: 6.42, rotation: 0.18, scale: 0.94 },
        { model: 4, x: -2.84, z: 6.62, rotation: -0.2, scale: 0.74 },
        { model: 1, x: -1.34, z: 6.74, rotation: -0.1, scale: 0.74 },
        { model: 5, x: 0.68, z: 6.76, rotation: 0.28, scale: 0.78 },
        { model: 1, x: 2.28, z: 6.66, rotation: -0.32, scale: 0.76 },
        { model: 4, x: 3.82, z: 6.44, rotation: 0.14, scale: 0.72 },
        { model: 5, x: 5.62, z: -3.28, rotation: -0.44, scale: 1.08 },
        { model: 4, x: 6.62, z: -2.38, rotation: 0.26, scale: 0.96 },
        { model: 2, x: 6.42, z: -0.48, rotation: -0.18, scale: 1.06 },
        { model: 5, x: 6.68, z: 1.12, rotation: 0.38, scale: 1.0 },
        { model: 3, x: 6.18, z: 3.38, rotation: -0.26, scale: 1.1 },
        { model: 0, x: 4.44, z: 4.98, rotation: 0.64, scale: 0.82 }
      ].map((placement, index) => ({
        model: placement.model,
        position: [
          placement.x,
          islandSurface.sampleHeight(placement.x, placement.z, islandSurface.topY),
          placement.z
        ] as [number, number, number],
        rotation: placement.rotation,
        scale: placement.scale,
        seed: 1700 + index * 97
      })),
    [islandSurface]
  );

  return (
    <group>
      {placements.map((placement, index) => (
        <TreeInstance
          key={index}
          model={library[placement.model].scene}
          lift={library[placement.model].lift}
          position={placement.position}
          rotation={placement.rotation}
          scale={placement.scale}
          seed={placement.seed + placement.model * 101}
        />
      ))}
    </group>
  );
}

function SignPost() {
  const islandSurface = useIslandSurfaceSampler();
  const signPost = usePreparedTree(SIGNPOST_MODEL_URL);

  const placement = useMemo(() => {
    const x = -ENTRY_PATH_HALF_WIDTH - 1.15;
    const z = BOARD_DEPTH / 2 + 2.95;
    const y = islandSurface.sampleHeight(x, z, islandSurface.topY) + 0.01;

    return {
      position: [x, y, z] as [number, number, number],
      rotation: 0.42,
      scale: 0.78
    };
  }, [islandSurface]);

  return (
    <group
      position={placement.position}
      rotation={[0, placement.rotation, 0]}
      scale={placement.scale}
      raycast={() => null}
    >
      <group position={[0, signPost.lift, 0]}>
        <Clone object={signPost.scene} />
      </group>
    </group>
  );
}

function AltarFlame({ lift }: { lift: number }) {
  const flameRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const flameGeometry = useMemo(() => {
    const profile = [
      new THREE.Vector2(0.02, 0),
      new THREE.Vector2(0.12, 0.04),
      new THREE.Vector2(0.17, 0.16),
      new THREE.Vector2(0.14, 0.3),
      new THREE.Vector2(0.07, 0.44),
      new THREE.Vector2(0, 0.52)
    ];
    const geometry = new THREE.LatheGeometry(profile, 9);
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  const innerFlameGeometry = useMemo(() => {
    const profile = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(0.07, 0.04),
      new THREE.Vector2(0.1, 0.13),
      new THREE.Vector2(0.08, 0.24),
      new THREE.Vector2(0.035, 0.34),
      new THREE.Vector2(0, 0.4)
    ];
    const geometry = new THREE.LatheGeometry(profile, 8);
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  const flameMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ff85d4",
        emissive: "#ff35b8",
        emissiveIntensity: 1.35,
        roughness: 0.46,
        metalness: 0,
        transparent: true,
        opacity: 0.86,
        flatShading: true
      }),
    []
  );
  const coreMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffeaff",
        emissive: "#fff4ff",
        emissiveIntensity: 1.8,
        roughness: 0.36,
        metalness: 0,
        transparent: true,
        opacity: 0.78,
        flatShading: true
      }),
    []
  );
  const baseGlowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ff45c6",
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      }),
    []
  );
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const flame = flameRef.current;

    if (flame) {
      const swayX = Math.sin(time * 2.4) * ALTAR_FLAME_SWAY_MAX_ANGLE;
      const swayZ = Math.cos(time * 2.9) * ALTAR_FLAME_SWAY_MAX_ANGLE * 0.62;
      const pulse = 1 + Math.sin(time * 7.2) * 0.06 + Math.sin(time * 11.5) * 0.025;

      flame.rotation.x = swayX;
      flame.rotation.z = swayZ;
      flame.position.y = Math.sin(time * 5.7) * 0.012;
      flame.scale.set(1 + Math.sin(time * 5.4) * 0.035, pulse, 1 + Math.cos(time * 4.8) * 0.035);
    }

    if (lightRef.current) {
      lightRef.current.intensity = 1.55 + Math.sin(time * 8.5) * 0.24 + Math.sin(time * 13.2) * 0.1;
    }
  });

  return (
    <group position={[0, lift + 0.5, 0.02]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.16, 18]} />
        <primitive object={baseGlowMaterial} attach="material" />
      </mesh>
      <group ref={flameRef} position={[0, 0.01, 0]} scale={0.44}>
        <mesh geometry={flameGeometry}>
          <primitive object={flameMaterial} attach="material" />
        </mesh>
        <mesh geometry={innerFlameGeometry} position={[0.018, 0.02, 0.015]} scale={[0.72, 0.84, 0.72]}>
          <primitive object={coreMaterial} attach="material" />
        </mesh>
      </group>
      <pointLight ref={lightRef} position={[0, 0.14, 0]} color="#ff8bd9" intensity={1.35} distance={2.7} decay={2} />
    </group>
  );
}

function ArcaneAltar() {
  const islandSurface = useIslandSurfaceSampler();
  const altar = usePreparedTree(ARCANE_ALTAR_MODEL_URL);

  const placement = useMemo(() => {
    const x = 0;
    const z = -BOARD_DEPTH / 2 - 1.95;
    const y = islandSurface.sampleHeight(x, z, islandSurface.topY) + 0.015;

    return {
      position: [x, y, z] as [number, number, number],
      rotation: Math.PI,
      scale: 1.08
    };
  }, [islandSurface]);

  return (
    <group
      position={placement.position}
      rotation={[0, placement.rotation, 0]}
      scale={placement.scale}
      raycast={() => null}
    >
      <group position={[0, altar.lift, 0]}>
        <Clone object={altar.scene} />
      </group>
      <AltarFlame lift={altar.lift} />
    </group>
  );
}

function StoneArch() {
  const islandSurface = useIslandSurfaceSampler();
  const arch = usePreparedTree(STONE_ARCH_MODEL_URL);

  const placement = useMemo(() => {
    const x = 0;
    const z = -BOARD_DEPTH / 2 - 4.8;
    const y = islandSurface.sampleHeight(x, z, islandSurface.topY) + 0.015;

    return {
      position: [x, y, z] as [number, number, number],
      rotation: Math.PI,
      scale: 1.08
    };
  }, [islandSurface]);

  return (
    <group
      position={placement.position}
      rotation={[0, placement.rotation, 0]}
      scale={placement.scale}
      raycast={() => null}
    >
      <group position={[0, arch.lift, 0]}>
        <Clone object={arch.scene} />
      </group>
    </group>
  );
}

function StoneLanterns() {
  const islandSurface = useIslandSurfaceSampler();
  const lantern = usePreparedTree(STONE_LANTERN_MODEL_URL);

  const placements = useMemo(() => {
    const edgeX = BOARD_WIDTH / 2 + 0.84;
    const edgeZ = BOARD_DEPTH / 2 + 0.84;
    const corners = [
      { x: -edgeX, z: -edgeZ, facing: Math.PI * 0.24 },
      { x: edgeX, z: -edgeZ, facing: -Math.PI * 0.24 },
      { x: -edgeX, z: edgeZ, facing: Math.PI * 0.76 },
      { x: edgeX, z: edgeZ, facing: -Math.PI * 0.76 }
    ];

    return corners.map((corner, index) => ({
      position: [
        corner.x,
        islandSurface.sampleHeight(corner.x, corner.z, islandSurface.topY) + 0.01,
        corner.z
      ] as [number, number, number],
      rotation: corner.facing + (seededNoise(5200 + index * 37) - 0.5) * 0.12,
      scale: 0.56 + seededNoise(5400 + index * 41) * 0.06
    }));
  }, [islandSurface]);

  return (
    <group>
      {placements.map((placement, index) => (
        <group
          key={index}
          position={placement.position}
          rotation={[0, placement.rotation, 0]}
          scale={placement.scale}
          raycast={() => null}
        >
          <group position={[0, lantern.lift, 0]}>
            <Clone object={lantern.scene} />
          </group>
        </group>
      ))}
    </group>
  );
}

function FacetedStonePiles() {
  const islandSurface = useIslandSurfaceSampler();
  const pile = usePreparedTree(FACETED_STONE_PILE_MODEL_URL);

  const placements = useMemo(
    () =>
      [
        { x: -BOARD_WIDTH / 2 - 2.45, z: BOARD_DEPTH / 2 + 2.75, rotation: 0.2, scale: 0.72 },
        { x: BOARD_WIDTH / 2 + 2.2, z: -BOARD_DEPTH / 2 - 3.75, rotation: -0.48, scale: 0.82 },
        { x: BOARD_WIDTH / 2 + 2.45, z: BOARD_DEPTH / 2 + 1.2, rotation: 0.84, scale: 0.7 }
      ].map((placement, index) => ({
        position: [
          placement.x,
          islandSurface.sampleHeight(placement.x, placement.z, islandSurface.topY) + 0.012,
          placement.z
        ] as [number, number, number],
        rotation: placement.rotation + (seededNoise(6100 + index * 47) - 0.5) * 0.16,
        scale: placement.scale + (seededNoise(6300 + index * 59) - 0.5) * 0.06
      })),
    [islandSurface]
  );

  return (
    <group>
      {placements.map((placement, index) => (
        <group
          key={index}
          position={placement.position}
          rotation={[0, placement.rotation, 0]}
          scale={placement.scale}
          raycast={() => null}
        >
          <group position={[0, pile.lift, 0]}>
            <Clone object={pile.scene} />
          </group>
        </group>
      ))}
    </group>
  );
}

function FoxWanderer({ positionRef }: { positionRef: MutableRefObject<THREE.Vector3> }) {
  const islandSurface = useIslandSurfaceSampler();
  const gltf = useGLTF(FOX_MODEL_URL);
  const foxRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const movementRef = useRef({
    position: new THREE.Vector2(BOARD_WIDTH / 2 + 2.35, 1.7),
    velocity: new THREE.Vector2(-0.16, -0.24),
    heading: -0.6,
    wanderAngle: 0
  });
  const wanderForceRef = useRef(new THREE.Vector2());
  const boundaryForceRef = useRef(new THREE.Vector2());
  const { actions } = useAnimations(gltf.animations, modelRef);

  const preparedFox = useMemo(() => {
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    const maxAxis = Math.max(size.x, size.y, size.z);
    const scale = maxAxis > 0 ? 1.44 / maxAxis : 1;
    const lift = Math.max(0, -bounds.min.y) * scale;

    return {
      scale,
      lift,
      centerOffset: [-center.x * scale, 0, -center.z * scale] as [number, number, number]
    };
  }, [gltf.scene]);

  useEffect(() => {
    const firstAction = Object.values(actions).find(Boolean);
    if (!firstAction) {
      return;
    }

    firstAction.reset();
    firstAction.fadeIn(0.2);
    firstAction.timeScale = 0.82;
    firstAction.play();

    return () => {
      firstAction.fadeOut(0.2);
    };
  }, [actions]);

  useFrame(({ clock }, delta) => {
    const fox = foxRef.current;
    if (!fox) {
      return;
    }

    const movement = movementRef.current;
    const position = movement.position;
    const velocity = movement.velocity;
    const time = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    movement.heading = Math.atan2(velocity.x, velocity.y);
    movement.wanderAngle +=
      Math.sin(time * 0.73) * 0.018 + (seededNoise(Math.floor(time * 2.1) + 9000) - 0.5) * 0.012;

    const wander = wanderForceRef.current.set(
      Math.sin(movement.heading + movement.wanderAngle),
      Math.cos(movement.heading + movement.wanderAngle)
    );
    const rho = Math.hypot(
      position.x / FOX_ISLAND_RADIUS_X,
      (position.y - FOX_ISLAND_CENTER_Z) / FOX_ISLAND_RADIUS_Z
    );
    const edgePush = smoothstep(0.72, 1, rho);
    const boundary = boundaryForceRef.current.set(
      -position.x / (FOX_ISLAND_RADIUS_X * FOX_ISLAND_RADIUS_X),
      -(position.y - FOX_ISLAND_CENTER_Z) / (FOX_ISLAND_RADIUS_Z * FOX_ISLAND_RADIUS_Z)
    );

    if (boundary.lengthSq() > 0) {
      boundary.normalize().multiplyScalar(edgePush * FOX_BOUNDARY_WEIGHT);
    }

    if (isInsidePathApron(position.x, position.y)) {
      boundary.x += position.x * 0.22;
      boundary.y += 0.68;
    }
    if (isInsideShrineCorridor(position.x, position.y)) {
      boundary.x += position.x * 0.18;
      boundary.y += 0.82;
    }

    velocity.addScaledVector(wander, FOX_WANDER_WEIGHT * dt);
    velocity.addScaledVector(boundary, dt);
    velocity.clampLength(FOX_MIN_SPEED, FOX_MAX_SPEED);
    position.addScaledVector(velocity, dt);

    const edgeRatio = Math.hypot(
      position.x / FOX_ISLAND_RADIUS_X,
      (position.y - FOX_ISLAND_CENTER_Z) / FOX_ISLAND_RADIUS_Z
    );
    if (edgeRatio > FOX_WALKABLE_EDGE_LIMIT) {
      const clampScale = FOX_WALKABLE_EDGE_LIMIT / edgeRatio;
      position.set(position.x * clampScale, FOX_ISLAND_CENTER_Z + (position.y - FOX_ISLAND_CENTER_Z) * clampScale);
      velocity.multiplyScalar(-0.45);
    }

    const sampledGroundY = islandSurface.sampleTopHeight(position.x, position.y, islandSurface.topY);
    const groundY = Math.max(sampledGroundY, FOX_MIN_GROUND_Y);
    fox.position.set(position.x, groundY + FOX_GROUND_CLEARANCE, position.y);
    fox.getWorldPosition(positionRef.current);
    fox.rotation.y = Math.atan2(velocity.x, velocity.y);
  });

  return (
    <group ref={foxRef} raycast={() => null}>
      <group ref={modelRef} position={preparedFox.centerOffset} scale={preparedFox.scale}>
        <primitive object={gltf.scene} position={[0, preparedFox.lift / preparedFox.scale, 0]} />
      </group>
    </group>
  );
}

function CameraRig({
  resetSignal,
  dragging,
  cameraMode,
  foxPositionRef
}: {
  resetSignal: number;
  dragging: boolean;
  cameraMode: CameraMode;
  foxPositionRef: MutableRefObject<THREE.Vector3>;
}) {
  const camera = useThree((state) => state.camera as THREE.PerspectiveCamera);
  const gl = useThree((state) => state.gl);
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const followTargetRef = useRef(new THREE.Vector3(...BOARD_LAYOUT.cameraTarget));
  const followCameraRef = useRef(new THREE.Vector3(...BOARD_LAYOUT.cameraPosition));
  const currentFollowTargetRef = useRef(new THREE.Vector3(...BOARD_LAYOUT.cameraTarget));
  const currentFollowCameraRef = useRef(new THREE.Vector3(...BOARD_LAYOUT.cameraPosition));
  const cameraBoundary = useMemo(
    () =>
      new THREE.Box3(
        new THREE.Vector3(
          -BOARD_WIDTH / 2 - CAMERA_TARGET_BOUNDARY_PADDING,
          -0.8,
          0.42 - BOARD_DEPTH / 2 - CAMERA_TARGET_BOUNDARY_PADDING
        ),
        new THREE.Vector3(
          BOARD_WIDTH / 2 + CAMERA_TARGET_BOUNDARY_PADDING,
          2.2,
          0.42 + BOARD_DEPTH / 2 + CAMERA_TARGET_BOUNDARY_PADDING
        )
      ),
    []
  );

  useEffect(() => {
    const controls = new CameraControlsImpl(camera, gl.domElement);
    controlsRef.current = controls;
    controls.smoothTime = 0.14;
    controls.draggingSmoothTime = 0.07;
    controls.dollySpeed = 0.32;
    controls.truckSpeed = 1.75;
    controls.azimuthRotateSpeed = 0.95;
    controls.polarRotateSpeed = 0.88;
    controls.dollyToCursor = true;
    controls.boundaryFriction = 0.18;
    controls.minDistance = BOARD_LAYOUT.cameraMinDistance;
    controls.maxDistance = BOARD_LAYOUT.cameraMaxDistance;
    controls.minPolarAngle = BOARD_LAYOUT.cameraMinPolarAngle;
    controls.maxPolarAngle = BOARD_LAYOUT.cameraMaxPolarAngle;
    controls.minAzimuthAngle = BOARD_LAYOUT.cameraMinAzimuthAngle;
    controls.maxAzimuthAngle = BOARD_LAYOUT.cameraMaxAzimuthAngle;
    controls.setBoundary(cameraBoundary);
    controls.mouseButtons.left = CameraControlsImpl.ACTION.NONE;
    controls.mouseButtons.middle = CameraControlsImpl.ACTION.TRUCK;
    controls.mouseButtons.right = CameraControlsImpl.ACTION.ROTATE;
    controls.mouseButtons.wheel = CameraControlsImpl.ACTION.DOLLY;
    controls.touches.one = CameraControlsImpl.ACTION.TOUCH_ROTATE;
    controls.touches.two = CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK;
    controls.touches.three = CameraControlsImpl.ACTION.TOUCH_TRUCK;

    void controls.setLookAt(
      BOARD_LAYOUT.cameraPosition[0],
      BOARD_LAYOUT.cameraPosition[1],
      BOARD_LAYOUT.cameraPosition[2],
      BOARD_LAYOUT.cameraTarget[0],
      BOARD_LAYOUT.cameraTarget[1],
      BOARD_LAYOUT.cameraTarget[2],
      false
    );

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, cameraBoundary, gl]);

  useLayoutEffect(() => {
    camera.position.set(...BOARD_LAYOUT.cameraPosition);
    camera.lookAt(...BOARD_LAYOUT.cameraTarget);
    camera.updateProjectionMatrix();
  }, [camera, resetSignal]);

  useEffect(() => {
    if (!controlsRef.current) {
      return;
    }

    void controlsRef.current.setLookAt(
      BOARD_LAYOUT.cameraPosition[0],
      BOARD_LAYOUT.cameraPosition[1],
      BOARD_LAYOUT.cameraPosition[2],
      BOARD_LAYOUT.cameraTarget[0],
      BOARD_LAYOUT.cameraTarget[1],
      BOARD_LAYOUT.cameraTarget[2],
      true
    );
  }, [resetSignal]);

  useEffect(() => {
    if (!controlsRef.current) {
      return;
    }

    controlsRef.current.enabled = !dragging && cameraMode === "free";
  }, [cameraMode, dragging]);

  useEffect(() => {
    function isInteractiveElement(target: EventTarget | null): boolean {
      return target instanceof HTMLElement && (target.isContentEditable || target.closest("button") !== null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      const controls = controlsRef.current;
      if (
        !controls ||
        dragging ||
        cameraMode !== "free" ||
        isInteractiveElement(event.target) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      let handled = true;

      switch (event.code) {
        case "ArrowLeft":
        case "KeyA":
          void controls.rotate(-KEYBOARD_ROTATE_STEP, 0, false);
          break;
        case "ArrowRight":
        case "KeyD":
          void controls.rotate(KEYBOARD_ROTATE_STEP, 0, false);
          break;
        case "ArrowUp":
        case "KeyW":
          void controls.rotate(0, -KEYBOARD_ROTATE_STEP, false);
          break;
        case "ArrowDown":
        case "KeyS":
          void controls.rotate(0, KEYBOARD_ROTATE_STEP, false);
          break;
        case "KeyQ":
          void controls.truck(-KEYBOARD_TRUCK_STEP, 0, false);
          break;
        case "KeyE":
          void controls.truck(KEYBOARD_TRUCK_STEP, 0, false);
          break;
        case "KeyR":
          void controls.truck(0, KEYBOARD_TRUCK_STEP, false);
          break;
        case "KeyF":
          void controls.truck(0, -KEYBOARD_TRUCK_STEP, false);
          break;
        case "Equal":
        case "NumpadAdd":
          void controls.dolly(KEYBOARD_DOLLY_STEP, false);
          break;
        case "Minus":
        case "NumpadSubtract":
          void controls.dolly(-KEYBOARD_DOLLY_STEP, false);
          break;
        case "Digit0":
        case "Numpad0":
          void controls.setLookAt(
            BOARD_LAYOUT.cameraPosition[0],
            BOARD_LAYOUT.cameraPosition[1],
            BOARD_LAYOUT.cameraPosition[2],
            BOARD_LAYOUT.cameraTarget[0],
            BOARD_LAYOUT.cameraTarget[1],
            BOARD_LAYOUT.cameraTarget[2],
            true
          );
          break;
        default:
          handled = false;
      }

      if (handled) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cameraMode, dragging]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    if (cameraMode === "followFox") {
      const foxPosition = foxPositionRef.current;
      const desiredTarget = followTargetRef.current.set(foxPosition.x, foxPosition.y + 0.58, foxPosition.z);
      const desiredCamera = followCameraRef.current.set(foxPosition.x, foxPosition.y + 4.2, foxPosition.z + 6.0);
      const blend = 1 - Math.exp(-delta * 3.2);
      const currentTarget = currentFollowTargetRef.current;
      const currentPosition = currentFollowCameraRef.current;

      controls.getTarget(currentTarget);
      currentPosition.copy(camera.position);
      currentTarget.lerp(desiredTarget, blend);
      currentPosition.lerp(desiredCamera, blend);

      void controls.setLookAt(
        currentPosition.x,
        currentPosition.y,
        currentPosition.z,
        currentTarget.x,
        currentTarget.y,
        currentTarget.z,
        false
      );
    }

    controls.update(delta);
  });

  return null;
}

function PerformanceSampler() {
  const gl = useThree((state) => state.gl);
  const setStats = usePerformanceStore((state) => state.setStats);
  const accumulatorRef = useRef(0);
  const frameCountRef = useRef(0);
  const frameMsSumRef = useRef(0);

  useFrame((_, delta) => {
    const frameMs = delta * 1000;
    accumulatorRef.current += delta;
    frameCountRef.current += 1;
    frameMsSumRef.current += frameMs;

    if (accumulatorRef.current < 0.2) {
      return;
    }

    const seconds = accumulatorRef.current;
    const frames = frameCountRef.current;
    const info = gl.info;

    setStats({
      fps: frames / seconds,
      frameMs: frameMsSumRef.current / frames,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures
    });

    accumulatorRef.current = 0;
    frameCountRef.current = 0;
    frameMsSumRef.current = 0;
  });

  return null;
}

function BoardWorld(props: Omit<CanvasSceneProps, "onClearSelection"> & { onClearSelection: () => void }) {
  const foxPositionRef = useRef(new THREE.Vector3(...BOARD_LAYOUT.cameraTarget));
  const boardTiles = useMemo(() => {
    const tiles: BoardCoord[] = [];
    for (let row = 0; row < BOARD_LAYOUT.rows; row += 1) {
      for (let col = 0; col < BOARD_LAYOUT.cols; col += 1) {
        tiles.push({ col, row });
      }
    }
    return tiles;
  }, []);

  return (
    <>
      <color attach="background" args={["#dbeefe"]} />
      <CameraRig
        resetSignal={props.cameraResetSignal}
        dragging={Boolean(props.draggingUnitId)}
        cameraMode={props.cameraMode}
        foxPositionRef={foxPositionRef}
      />
      <PerformanceSampler />
      <SkyDome />
      <CloudSea />
      <hemisphereLight args={["#f1f7ff", "#b7c79a", 1.4]} />
      <ambientLight intensity={0.72} color="#fff8ee" />
      <directionalLight
        castShadow
        position={[-9.5, 13.5, 8.5]}
        intensity={2.65}
        color="#fff1d8"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00008}
        shadow-normalBias={0.025}
        shadow-camera-near={1}
        shadow-camera-far={32}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[8.2, 6.8, -7.6]} intensity={0.82} color="#dce9ff" />
      <directionalLight position={[1.8, 8.5, 11.5]} intensity={0.38} color="#fff9ef" />
      <pointLight position={[0, 3.4, 3.6]} intensity={0.14} color="#fff3d9" distance={15} />
      <group position={[0, 0, 0.42]}>
        <Suspense fallback={null}>
          <FloatingIsland />
        </Suspense>
        <EntryPath />
        <ArenaFrame />
        <Suspense fallback={null}>
          <TreeScatter />
        </Suspense>
        <Suspense fallback={null}>
          <StoneArch />
        </Suspense>
        <Suspense fallback={null}>
          <ArcaneAltar />
        </Suspense>
        <Suspense fallback={null}>
          <StoneLanterns />
        </Suspense>
        <Suspense fallback={null}>
          <SignPost />
        </Suspense>
        <Suspense fallback={null}>
          <FacetedStonePiles />
        </Suspense>
        <Suspense fallback={null}>
          <FoxWanderer positionRef={foxPositionRef} />
        </Suspense>
        <PerimeterGrass />
        <StoneScatter />
        {boardTiles.map((coord) => (
          <BoardTile
            key={`${coord.col}-${coord.row}`}
            coord={coord}
            highlighted={
              props.hoveredBoardCoord?.col === coord.col && props.hoveredBoardCoord?.row === coord.row
            }
            selected={false}
            onHover={props.onBoardHover}
            onClick={props.onClearSelection}
          />
        ))}
        {props.units
          .filter((unit) => unit.placement.kind === "board" && unit.id !== props.draggingUnitId)
          .map((unit) => (
            <UnitPiece
              key={unit.id}
              unit={unit}
              selected={props.selectedUnitId === unit.id}
              onPointerDown={() => props.onBoardUnitPointerDown(unit.id)}
            />
          ))}
      </group>
      <ContactShadows position={[0, -0.22, 0.42]} opacity={0.24} scale={24} blur={3.4} far={16} color="#6d727a" />
    </>
  );
}

useGLTF.preload(TREE_MODEL_URLS.blossom);
useGLTF.preload(TREE_MODEL_URLS.layeredPine);
useGLTF.preload(TREE_MODEL_URLS.lowPoly);
useGLTF.preload(TREE_MODEL_URLS.pink);
useGLTF.preload(TREE_MODEL_URLS.polygonalPine);
useGLTF.preload(TREE_MODEL_URLS.polygonalTree);
useGLTF.preload(SIGNPOST_MODEL_URL);
useGLTF.preload(ARCANE_ALTAR_MODEL_URL);
useGLTF.preload(STONE_ARCH_MODEL_URL);
useGLTF.preload(STONE_LANTERN_MODEL_URL);
useGLTF.preload(FACETED_STONE_PILE_MODEL_URL);
useGLTF.preload(FOX_MODEL_URL);

export function CanvasScene(props: CanvasSceneProps) {
  return (
    <div
      className="canvas-surface"
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: BOARD_LAYOUT.cameraPosition, fov: 38 }}
        onPointerMissed={() => {
          props.onClearSelection();
        }}
      >
        <BoardWorld {...props} />
      </Canvas>
    </div>
  );
}

useGLTF.preload(ISLAND_MODEL_URL);
