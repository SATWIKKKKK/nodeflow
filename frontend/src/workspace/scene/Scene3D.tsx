import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { SceneGraph, SceneNode } from "./graph";
import Nodes, { type NodeVisual } from "./Nodes";
import Edges from "./Edges";
import { scenePalettes } from "./palette";
import { useThemePreference } from "../../lib/theme";

const HINT_KEY = "noesis:scene-hint-seen";

/** The distance the automatic framing settled on. */
type BaseDistance = { current: number | null };

/**
 * Applies the +/- zoom buttons, and only those.
 *
 * It used to hold the camera at a fixed distance on every frame, which undid
 * whatever the reader did with a mouse: a scroll-wheel zoom or a pan snapped
 * straight back, so the view seemed to refuse to move. Now a change of level
 * eases the camera along its current line (towards whatever the controls are
 * orbiting) and then lets go; between button presses the mouse, trackpad and
 * touch have the camera to themselves.
 */
function Dolly({ level }: { level: number }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as {
    target?: THREE.Vector3;
    update?: () => void;
  } | null;
  const goal = useRef<number | null>(null);
  const last = useRef(level);

  useEffect(() => {
    if (level === last.current) return;
    const pivot = controls?.target ?? new THREE.Vector3();
    goal.current = camera.position.distanceTo(pivot) * (last.current / level);
    last.current = level;
  }, [level, camera, controls]);

  useFrame(() => {
    if (goal.current === null) return;
    const pivot = controls?.target ?? new THREE.Vector3();
    const offset = camera.position.clone().sub(pivot);
    const length = offset.length();
    if (length < 0.001 || Math.abs(length - goal.current) < 0.02) {
      goal.current = null;
      return;
    }
    offset.multiplyScalar(1 + (goal.current / length - 1) * 0.18);
    camera.position.copy(pivot).add(offset);
    controls?.update?.();
  });
  return null;
}

function SceneFallback({ detail }: { detail: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-headline-sm text-primary">3D view unavailable</p>
      <span className="max-w-sm text-body-md text-blueprint-muted">{detail}</span>
    </div>
  );
}

/**
 * Probed before mounting the Canvas, not caught afterwards: three throws its
 * "Error creating WebGL context" outside React's render phase, where an error
 * boundary can never see it.
 */
function detectWebGL(): boolean {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
  } catch {
    return false;
  }
}

/** WebGL can fail outright (no GPU, blocked context). Never take the page down with it. */
class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.failed) {
      return <SceneFallback detail="Your browser or GPU blocked WebGL. Playback and the editor still work." />;
    }

    return this.props.children;
  }
}

/**
 * Fits the camera to the structure — but only while the user has never touched
 * the controls. Once they have orbited, their framing is theirs to keep, and
 * playback steps never move the camera either way.
 */
const VIEW_DIRECTION = new THREE.Vector3(0.44, 0.52, 0.82).normalize();
/** Keep-out around each node. The label sits above the sphere, so the vertical
 *  reach is much larger than the horizontal one — padding both by the same
 *  amount wastes a third of the frame width. */
const PAD_HORIZONTAL = 0.78;
const PAD_VERTICAL = 1.36;

/**
 * Fits the camera to the structure, exactly.
 *
 * Solves for the smallest distance along a fixed three-quarter view direction
 * that keeps every node inside both frustum axes. A naive radius fit badly
 * over-shoots here, because the layout is a flat plane seen at an angle.
 */
function AutoFrame({
  points,
  locked,
  base
}: {
  points: Array<[number, number, number]>;
  locked: boolean;
  base: BaseDistance;
}) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const framed = useRef({ distance: 0, aspect: 0 });

  useEffect(() => {
    if (locked || !points.length) return;

    const aspect = size.width / Math.max(1, size.height);
    const perspective = camera as THREE.PerspectiveCamera;
    const vFov = ((perspective.fov ?? 42) * Math.PI) / 180;
    const tanV = Math.tan(vFov / 2);
    const tanH = Math.tan(Math.atan(tanV * aspect));

    // Camera basis for a view aimed at the origin from VIEW_DIRECTION.
    const forward = VIEW_DIRECTION.clone().negate();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const point = new THREE.Vector3();

    let required = 6;
    for (const position of points) {
      point.set(...position);
      const depth = point.dot(forward);
      const horizontal = Math.abs(point.dot(right)) + PAD_HORIZONTAL;
      const vertical = Math.abs(point.dot(up)) + PAD_VERTICAL;
      // |offset| <= (depth + d) * tan  =>  d >= |offset| / tan - depth
      required = Math.max(required, horizontal / tanH - depth, vertical / tanV - depth);
    }

    const distance = required * 1.08;
    // The points cover the whole replay, so this settles once per trace and
    // playback never nudges the camera; a new trace or a resize reframes.
    const changed = Math.abs(distance - framed.current.distance) > framed.current.distance * 0.05;
    const reshaped = Math.abs(aspect - framed.current.aspect) > 0.05;
    if (!changed && !reshaped) return;

    framed.current = { distance, aspect };
    base.current = distance;
    camera.position.copy(VIEW_DIRECTION.clone().multiplyScalar(distance));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [points, locked, camera, size.width, size.height, base]);

  return null;
}

interface Scene3DProps {
  graph: SceneGraph;
  activeIds: Set<string>;
  selectedId: string | null;
  onSelectNode: (id: string | null) => void;
  onWebGLError: () => void;
  /**
   * How far in the reader has asked to be, as a plain level.
   *
   * The scene could always be zoomed with a scroll wheel, which is no help to
   * anyone who has not thought to try it. A level is easier to reason about
   * than a camera position, and the camera is moved to match it rather than
   * the other way round.
   */
  zoom?: number;
}

export default function Scene3D({
  graph,
  activeIds,
  selectedId,
  onSelectNode,
  onWebGLError,
  zoom = 1
}: Scene3DProps) {
  const [hintVisible, setHintVisible] = useState(false);
  const [userFramed, setUserFramed] = useState(false);
  const [webglReady] = useState(detectWebGL);
  const [exiting, setExiting] = useState<Map<string, SceneNode>>(() => new Map());
  const { resolved } = useThemePreference();
  const palette = scenePalettes[resolved];
  const previousNodes = useRef<SceneNode[]>([]);
  const baseDistance = useRef<number | null>(null);

  useEffect(() => {
    try {
      setHintVisible(window.localStorage.getItem(HINT_KEY) !== "1");
    } catch {
      // Private mode or blocked storage: showing the hint is the safe default.
      setHintVisible(true);
    }
  }, []);

  const dismissHint = () => {
    setHintVisible((visible) => {
      if (visible) {
        try {
          window.localStorage.setItem(HINT_KEY, "1");
        } catch {
          // Dismissal just won't persist; not worth surfacing.
        }
      }
      return false;
    });
  };

  // Nodes that left the trace state keep rendering until their fade finishes.
  useEffect(() => {
    const liveIds = new Set(graph.nodes.map((node) => node.id));

    setExiting((previous) => {
      const next = new Map(previous);
      for (const node of previousNodes.current) {
        if (!liveIds.has(node.id)) next.set(node.id, node);
      }
      for (const id of liveIds) next.delete(id);
      return next;
    });

    previousNodes.current = graph.nodes;
  }, [graph]);

  const visuals = useMemo<NodeVisual[]>(() => {
    const live = graph.nodes.map((node) => ({
      ...node,
      active: activeIds.has(node.id),
      selected: selectedId === node.id,
      exiting: false
    }));

    const leaving = [...exiting.values()].map((node) => ({
      ...node,
      active: false,
      selected: false,
      exiting: true
    }));

    return [...live, ...leaving];
  }, [graph.nodes, activeIds, selectedId, exiting]);

  const positions = useMemo(() => {
    const map = new Map<string, [number, number, number]>();
    for (const node of graph.nodes) map.set(node.id, node.position);
    return map;
  }, [graph.nodes]);

  const activeEdges = useMemo(() => {
    const set = new Set<string>();
    for (const edge of graph.edges) {
      if (activeIds.has(edge.from) || activeIds.has(edge.to)) set.add(edge.id);
    }
    return set;
  }, [graph.edges, activeIds]);

  const handleExited = (id: string) => {
    setExiting((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
  };

  if (!webglReady) {
    // A permanent capability gap, not a transient stall — explain it in place
    // rather than raising the stuck dialog over the whole workspace.
    return (
      <div className="relative h-full min-h-0 bg-card">
        <SceneFallback detail="This browser or GPU has WebGL disabled. Playback and the editor still work." />
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 bg-card" onPointerDown={dismissHint} onWheel={dismissHint}>
      <SceneBoundary onError={onWebGLError}>
        <Canvas
          shadows="soft"
          dpr={[1, 2]}
          // Camera is configured once. Playback never touches it, so the user's
          // framing survives every step, run, and structural change.
          camera={{ position: [6.5, 7, 11], fov: 30, near: 0.1, far: 400 }}
          onPointerMissed={() => onSelectNode(null)}
          gl={{ antialias: true, alpha: true }}
        >
          <color key={resolved} attach="background" args={[palette.background]} />

          <ambientLight intensity={resolved === "dark" ? 0.9 : 1.15} />
          <directionalLight
            position={[7, 12, 6]}
            intensity={1.5}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-radius={7}
            shadow-bias={-0.0004}
            shadow-camera-left={-22}
            shadow-camera-right={22}
            shadow-camera-top={22}
            shadow-camera-bottom={-22}
          />

          {/* Shadow catcher: invisible except where geometry darkens it. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.64, 0]} receiveShadow>
            <planeGeometry args={[120, 120]} />
            <shadowMaterial transparent opacity={palette.shadowOpacity} />
          </mesh>

          <Grid
            position={[0, -0.64, 0]}
            infiniteGrid
            cellSize={0.8}
            cellThickness={0.5}
            cellColor={palette.gridCell}
            sectionSize={4}
            sectionThickness={0.8}
            sectionColor={palette.gridSection}
            fadeDistance={38}
            fadeStrength={1.4}
            followCamera={false}
          />

          <AutoFrame points={graph.bounds} locked={userFramed} base={baseDistance} />

          <Nodes nodes={visuals} palette={palette} onSelect={onSelectNode} onExited={handleExited} />
          <Edges edges={graph.edges} positions={positions} activeEdges={activeEdges} palette={palette} />

          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.075}
            rotateSpeed={0.65}
            zoomSpeed={0.8}
            panSpeed={0.7}
            minDistance={4}
            maxDistance={Math.max(60, graph.extent * 10)}
            // Stops the scene from tipping past level or under the floor.
            minPolarAngle={0.18}
            maxPolarAngle={Math.PI / 2.15}
            target={[0, 0, 0]}
            onStart={() => setUserFramed(true)}
          />

          <Dolly level={zoom} />
        </Canvas>
      </SceneBoundary>

      {hintVisible && (
        <div
          role="note"
          // Top left, clear of the zoom control in the bottom corner; worded
          // for whatever the reader is holding.
          className="neu-tag pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-full border border-blueprint-line bg-card px-3 py-1.5 text-technical-mono text-blueprint-muted shadow-[0_10px_26px_rgba(0,0,0,0.07)]"
        >
          {typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches
            ? "Drag to rotate · pinch to zoom"
            : "Drag to rotate · scroll to zoom"}
        </div>
      )}
    </div>
  );
}
